import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RegradeStatus } from '@prisma/client';
import { RegradesRepository } from './regrades.repository';
import {
  CreateRegradeRequestDto,
  RegradeListDto,
  RegradeReviewDecision,
  ReviewRegradeDto,
} from './dto/regrade.dto';
import { GradesService } from '../grades/grades.service';
import { GradesRepository } from '../grades/grades.repository';
import { CoursesClient } from '../clients/courses.client';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { REGRADE_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { buildPaginated } from '../common/dto/pagination.dto';
import { requireStudentId } from '../common/utils/actor.util';

@Injectable()
export class RegradesService {
  private readonly logger = new Logger(RegradesService.name);

  constructor(
    private readonly repo: RegradesRepository,
    private readonly grades: GradesService,
    private readonly gradesRepo: GradesRepository,
    private readonly coursesClient: CoursesClient,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  async request(
    gradeId: string,
    dto: CreateRegradeRequestDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const studentId = requireStudentId(actor);

    const grade = await this.gradesRepo.findById(gradeId);
    if (!grade) throw new NotFoundException('Grade not found');
    if (grade.studentId !== studentId) {
      throw new ForbiddenException('You can only request regrades on your own grades');
    }

    const open = await this.repo.findOpenForGrade(gradeId);
    if (open) {
      throw new BadRequestException(
        'An open regrade request already exists for this grade',
      );
    }

    const created = await this.repo.create({
      gradeId,
      studentId,
      requestedByUserId: actor.sub,
      reason: dto.reason,
      status: RegradeStatus.SUBMITTED,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'regrade.requested',
      entity: 'RegradeRequest',
      entityId: created.id,
      ipAddress: ip,
      metadata: { gradeId, studentId },
    });

    this.events.publish(REGRADE_EVENTS.REQUESTED, {
      regradeId: created.id,
      gradeId,
      studentId,
    });

    return created;
  }

  async review(
    id: string,
    dto: ReviewRegradeDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    if (actor.role !== 'Teacher' && actor.role !== 'Admin') {
      throw new ForbiddenException('Only Teachers/Admins can review regrades');
    }

    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Regrade request not found');
    if (
      existing.status !== RegradeStatus.SUBMITTED &&
      existing.status !== RegradeStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException('Regrade is not open for review');
    }

    const grade = await this.gradesRepo.findById(existing.gradeId);
    if (!grade) throw new NotFoundException('Underlying grade no longer exists');

    // For Teachers, ensure they teach the underlying course/term
    if (actor.role === 'Teacher') {
      const ok = await this.coursesClient.isTeacherAssignedToCourse(
        actor.sub,
        grade.assessment.courseId,
        grade.assessment.academicTerm,
        grade.assessment.sectionCode ?? undefined,
      );
      if (!ok) {
        throw new ForbiddenException('Teacher is not assigned to this course');
      }
    }

    if (dto.decision === RegradeReviewDecision.APPROVE) {
      if (dto.newRawScore === undefined) {
        throw new BadRequestException(
          'newRawScore is required when approving a regrade',
        );
      }
      // Override grade (Admin route requires Admin actor inside service); for
      // teachers, perform an updateGrade with PUBLISHED → AMENDED semantics.
      if (actor.role === 'Admin') {
        await this.grades.overrideGrade(
          existing.gradeId,
          { rawScore: dto.newRawScore, reason: `Regrade ${id}: ${existing.reason}` },
          actor,
          ip,
        );
      } else {
        await this.grades.updateGrade(
          existing.gradeId,
          { rawScore: dto.newRawScore },
          actor,
          ip,
        );
      }

      const updated = await this.repo.update(id, {
        status: RegradeStatus.APPROVED,
        reviewedByUserId: actor.sub,
        reviewerNotes: dto.reviewerNotes,
        previousRawScore: grade.rawScore,
        newRawScore: dto.newRawScore,
        reviewedAt: new Date(),
      });

      await this.auditLog.log({
        userId: actor.sub,
        action: 'regrade.approved',
        entity: 'RegradeRequest',
        entityId: id,
        ipAddress: ip,
        metadata: {
          gradeId: existing.gradeId,
          previousRaw: Number(grade.rawScore),
          newRaw: dto.newRawScore,
        },
      });

      this.events.publish(REGRADE_EVENTS.REVIEWED, {
        regradeId: id,
        gradeId: existing.gradeId,
        studentId: existing.studentId,
        decision: 'APPROVED',
        newRawScore: dto.newRawScore,
      });

      return updated;
    }

    // REJECT
    const updated = await this.repo.update(id, {
      status: RegradeStatus.REJECTED,
      reviewedByUserId: actor.sub,
      reviewerNotes: dto.reviewerNotes,
      reviewedAt: new Date(),
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'regrade.rejected',
      entity: 'RegradeRequest',
      entityId: id,
      ipAddress: ip,
      metadata: {
        gradeId: existing.gradeId,
        notes: dto.reviewerNotes,
      },
    });

    this.events.publish(REGRADE_EVENTS.REVIEWED, {
      regradeId: id,
      gradeId: existing.gradeId,
      studentId: existing.studentId,
      decision: 'REJECTED',
    });

    return updated;
  }

  async list(filters: RegradeListDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { items, total } = await this.repo.list({
      studentId: filters.studentId,
      gradeId: filters.gradeId,
      page,
      limit,
    });
    return buildPaginated(items, total, page, limit);
  }
}
