import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentStatus, GradeStatus, Prisma } from '@prisma/client';
import { GradesRepository } from './grades.repository';
import {
  BulkCreateGradesDto,
  CreateGradeDto,
  OverrideGradeDto,
  UpdateGradeDto,
} from './dto/grade.dto';
import { GradeFilterDto } from './dto/grade-filter.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { GRADE_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { AssessmentsService } from '../assessments/assessments.service';
import { CoursesClient } from '../clients/courses.client';
import { EnrollmentClient } from '../clients/enrollment.client';
import { GradingScalesService } from '../grading-scales/grading-scales.service';
import { buildPaginated } from '../common/dto/pagination.dto';

@Injectable()
export class GradesService {
  private readonly logger = new Logger(GradesService.name);

  constructor(
    private readonly repo: GradesRepository,
    private readonly assessments: AssessmentsService,
    private readonly coursesClient: CoursesClient,
    private readonly enrollmentClient: EnrollmentClient,
    private readonly gradingScales: GradingScalesService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  // ─── Single entry ───────────────────────────────────────────────────────

  async upsertGrade(dto: CreateGradeDto, actor: JwtPayload, ip?: string) {
    const assessment = await this.assessments.findById(dto.assessmentId);
    if (assessment.status === AssessmentStatus.ARCHIVED) {
      throw new BadRequestException('Cannot grade archived assessments');
    }

    await this.assertActorCanGrade(actor, assessment);

    if (dto.rawScore > Number(assessment.maxScore)) {
      throw new BadRequestException(
        `rawScore (${dto.rawScore}) exceeds maxScore (${assessment.maxScore})`,
      );
    }

    // Verify roster: student must be ENROLLED in the (course, term)
    const enrolled = await this.enrollmentClient.isActivelyEnrolled(
      dto.studentId,
      assessment.courseId,
      assessment.academicTerm,
    );
    if (!enrolled) {
      throw new BadRequestException(
        'Student is not actively enrolled in the assessment course/term',
      );
    }

    const percentage = this.computePercentage(
      dto.rawScore,
      Number(assessment.maxScore),
    );
    const { letterGrade } = await this.gradingScales
      .resolveLetterGrade(percentage)
      .catch(() => ({ letterGrade: null as unknown as string }));

    const status = dto.status ?? GradeStatus.DRAFT;
    const isAmend =
      !!(await this.repo.findByAssessmentAndStudent(
        dto.assessmentId,
        dto.studentId,
      ));

    const saved = await this.repo.upsert({
      assessmentId: dto.assessmentId,
      studentId: dto.studentId,
      enrollmentId: dto.enrollmentId ?? null,
      rawScore: new Prisma.Decimal(dto.rawScore),
      percentageScore: new Prisma.Decimal(percentage),
      letterGrade: letterGrade ?? null,
      remarks: dto.remarks,
      gradedByUserId: actor.sub,
      status: isAmend && status === GradeStatus.PUBLISHED
        ? GradeStatus.AMENDED
        : status,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: isAmend ? 'grade.amended' : 'grade.created',
      entity: 'Grade',
      entityId: saved.id,
      ipAddress: ip,
      metadata: {
        assessmentId: saved.assessmentId,
        studentId: saved.studentId,
        rawScore: dto.rawScore,
        percentage,
        status: saved.status,
      },
    });

    if (saved.status === GradeStatus.PUBLISHED) {
      this.events.publish(GRADE_EVENTS.PUBLISHED, this.gradeEnvelope(saved, assessment));
    } else if (saved.status === GradeStatus.AMENDED) {
      this.events.publish(GRADE_EVENTS.AMENDED, this.gradeEnvelope(saved, assessment));
    } else {
      this.events.publish(GRADE_EVENTS.SUBMITTED, this.gradeEnvelope(saved, assessment));
    }

    return saved;
  }

  // ─── Bulk entry ─────────────────────────────────────────────────────────

  async bulkUpsert(dto: BulkCreateGradesDto, actor: JwtPayload, ip?: string) {
    const assessment = await this.assessments.findById(dto.assessmentId);
    if (assessment.status === AssessmentStatus.ARCHIVED) {
      throw new BadRequestException('Cannot grade archived assessments');
    }
    await this.assertActorCanGrade(actor, assessment);

    const maxScore = Number(assessment.maxScore);
    const status = dto.status ?? GradeStatus.DRAFT;

    // Pre-validate scores
    for (const e of dto.entries) {
      if (e.rawScore > maxScore) {
        throw new BadRequestException(
          `rawScore for student ${e.studentId} exceeds maxScore (${maxScore})`,
        );
      }
    }

    // Pre-fetch roster + scale once
    const roster = await this.enrollmentClient.getRoster(
      assessment.courseId,
      assessment.academicTerm,
      assessment.sectionCode ?? undefined,
    );
    const enrolledIds = new Set(
      roster
        .filter((r) => r.status === 'ENROLLED' || r.status === 'COMPLETED')
        .map((r) => r.studentId),
    );

    // Identify any non-enrolled students; reject the whole batch (atomic semantics).
    const offenders = dto.entries
      .filter((e) => !enrolledIds.has(e.studentId))
      .map((e) => e.studentId);
    if (offenders.length) {
      throw new BadRequestException(
        `These students are not enrolled in the course/term: ${offenders.join(', ')}`,
      );
    }

    const percentages = dto.entries.map((e) =>
      this.computePercentage(e.rawScore, maxScore),
    );
    const resolutions = await this.gradingScales
      .resolveBatch(percentages)
      .catch(() => percentages.map(() => ({ letterGrade: null as unknown as string, gradePoints: 0 })));

    const results = [];
    for (let i = 0; i < dto.entries.length; i++) {
      const e = dto.entries[i];
      const existing = await this.repo.findByAssessmentAndStudent(
        dto.assessmentId,
        e.studentId,
      );
      const finalStatus =
        existing && status === GradeStatus.PUBLISHED
          ? GradeStatus.AMENDED
          : status;

      const saved = await this.repo.upsert({
        assessmentId: dto.assessmentId,
        studentId: e.studentId,
        enrollmentId: e.enrollmentId ?? null,
        rawScore: new Prisma.Decimal(e.rawScore),
        percentageScore: new Prisma.Decimal(percentages[i]),
        letterGrade: resolutions[i]?.letterGrade ?? null,
        remarks: e.remarks,
        gradedByUserId: actor.sub,
        status: finalStatus,
      });
      results.push(saved);
    }

    await this.auditLog.log({
      userId: actor.sub,
      action: 'grade.bulk_upsert',
      entity: 'Assessment',
      entityId: dto.assessmentId,
      ipAddress: ip,
      metadata: { count: results.length, status },
    });

    this.events.publish(GRADE_EVENTS.SUBMITTED, {
      assessmentId: dto.assessmentId,
      courseId: assessment.courseId,
      academicTerm: assessment.academicTerm,
      count: results.length,
      status,
    });

    return { count: results.length, items: results };
  }

  // ─── Manual update ─────────────────────────────────────────────────────

  async updateGrade(
    id: string,
    dto: UpdateGradeDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Grade not found');
    await this.assertActorCanGrade(actor, existing.assessment);

    const update: Prisma.GradeUncheckedUpdateInput = { remarks: dto.remarks };
    let percentage: number | undefined;

    if (dto.rawScore !== undefined) {
      if (dto.rawScore > Number(existing.assessment.maxScore)) {
        throw new BadRequestException('rawScore exceeds maxScore');
      }
      percentage = this.computePercentage(
        dto.rawScore,
        Number(existing.assessment.maxScore),
      );
      const resolution = await this.gradingScales
        .resolveLetterGrade(percentage)
        .catch(() => ({ letterGrade: null as unknown as string }));
      update.rawScore = new Prisma.Decimal(dto.rawScore);
      update.percentageScore = new Prisma.Decimal(percentage);
      update.letterGrade = resolution.letterGrade ?? null;
    }

    if (dto.status) {
      // Updating from PUBLISHED counts as AMENDED for audit/event purposes.
      update.status =
        existing.status === GradeStatus.PUBLISHED &&
        dto.status === GradeStatus.PUBLISHED
          ? GradeStatus.AMENDED
          : dto.status;
    }

    update.gradedByUserId = actor.sub;
    update.gradedAt = new Date();

    const saved = await this.repo.update(id, update);

    await this.auditLog.log({
      userId: actor.sub,
      action: 'grade.updated',
      entity: 'Grade',
      entityId: id,
      ipAddress: ip,
      metadata: {
        from: {
          rawScore: Number(existing.rawScore),
          status: existing.status,
        },
        to: {
          rawScore: dto.rawScore,
          status: saved.status,
        },
      },
    });

    if (saved.status === GradeStatus.AMENDED) {
      this.events.publish(GRADE_EVENTS.AMENDED, this.gradeEnvelope(saved, existing.assessment));
    }

    return saved;
  }

  // ─── Admin override ────────────────────────────────────────────────────

  async overrideGrade(
    id: string,
    dto: OverrideGradeDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    if (actor.role !== 'Admin') {
      throw new ForbiddenException('Only Admin can override grades');
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Grade not found');

    if (dto.rawScore > Number(existing.assessment.maxScore)) {
      throw new BadRequestException('rawScore exceeds maxScore');
    }
    const percentage = this.computePercentage(
      dto.rawScore,
      Number(existing.assessment.maxScore),
    );
    const resolution = await this.gradingScales
      .resolveLetterGrade(percentage)
      .catch(() => ({ letterGrade: null as unknown as string }));

    const saved = await this.repo.update(id, {
      rawScore: new Prisma.Decimal(dto.rawScore),
      percentageScore: new Prisma.Decimal(percentage),
      letterGrade: resolution.letterGrade ?? null,
      status: GradeStatus.AMENDED,
      gradedByUserId: actor.sub,
      gradedAt: new Date(),
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'grade.overridden',
      entity: 'Grade',
      entityId: id,
      ipAddress: ip,
      metadata: {
        previousRaw: Number(existing.rawScore),
        newRaw: dto.rawScore,
        reason: dto.reason,
      },
    });

    this.events.publish(GRADE_EVENTS.OVERRIDDEN, {
      ...this.gradeEnvelope(saved, existing.assessment),
      reason: dto.reason,
      overriddenByUserId: actor.sub,
    });

    return saved;
  }

  // ─── Reads ─────────────────────────────────────────────────────────────

  async findById(id: string) {
    const g = await this.repo.findById(id);
    if (!g) throw new NotFoundException('Grade not found');
    return g;
  }

  async findByIdForActor(id: string, actor: JwtPayload) {
    const g = await this.findById(id);
    if (actor.role === 'Student') {
      const studentId = actor.studentId || actor.sub;
      if (g.studentId !== studentId) {
        throw new ForbiddenException('You can only access your own grades');
      }
    }
    return g;
  }

  async list(filters: GradeFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { items, total } = await this.repo.list({
      studentId: filters.studentId,
      courseId: filters.courseId,
      academicTerm: filters.academicTerm,
      teacherId: filters.teacherId,
      assessmentId: filters.assessmentId,
      assessmentType: filters.assessmentType,
      status: filters.status,
      page,
      limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
    return buildPaginated(items, total, page, limit);
  }

  myGrades(actor: JwtPayload, term?: string) {
    const studentId = actor.studentId || actor.sub;
    return this.repo.findManyByStudent(studentId, term);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private computePercentage(rawScore: number, maxScore: number): number {
    if (maxScore <= 0) {
      throw new BadRequestException('Assessment maxScore must be > 0');
    }
    const pct = (rawScore / maxScore) * 100;
    return Math.round(pct * 100) / 100;
  }

  private async assertActorCanGrade(
    actor: JwtPayload,
    assessment: { courseId: string; academicTerm: string; sectionCode: string | null },
  ) {
    if (actor.role === 'Admin') return;
    if (actor.role !== 'Teacher') {
      throw new ForbiddenException('Only Teachers and Admins can enter grades');
    }
    const ok = await this.coursesClient.isTeacherAssignedToCourse(
      actor.sub,
      assessment.courseId,
      assessment.academicTerm,
      assessment.sectionCode ?? undefined,
    );
    if (!ok) {
      throw new ForbiddenException(
        'Teacher is not assigned to this course/term/section',
      );
    }
  }

  private gradeEnvelope(
    grade: {
      id: string;
      assessmentId: string;
      studentId: string;
      rawScore: Prisma.Decimal;
      percentageScore: Prisma.Decimal;
      letterGrade: string | null;
      status: GradeStatus;
    },
    assessment: { courseId: string; academicTerm: string },
  ): Record<string, unknown> {
    return {
      gradeId: grade.id,
      assessmentId: grade.assessmentId,
      studentId: grade.studentId,
      courseId: assessment.courseId,
      academicTerm: assessment.academicTerm,
      rawScore: Number(grade.rawScore),
      percentageScore: Number(grade.percentageScore),
      letterGrade: grade.letterGrade,
      status: grade.status,
    };
  }
}
