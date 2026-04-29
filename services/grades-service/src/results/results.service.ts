import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Assessment,
  GradeStatus,
  Prisma,
  ResultStatus,
} from '@prisma/client';
import { ResultsRepository } from './results.repository';
import { GradesRepository } from '../grades/grades.repository';
import { AssessmentsService } from '../assessments/assessments.service';
import { GradingScalesService } from '../grading-scales/grading-scales.service';
import { CoursesClient } from '../clients/courses.client';
import { EnrollmentClient } from '../clients/enrollment.client';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { GRADE_EVENTS, RESULT_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { PrismaService } from '../database/prisma.service';
import { RedisLockService } from '../locks/redis-lock.service';

interface ComputedResult {
  studentId: string;
  enrollmentId: string | null;
  weightedScore: number;
  letterGrade: string;
  gradePoints: number;
  creditsEarned: number;
  resultStatus: ResultStatus;
}

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  constructor(
    private readonly repo: ResultsRepository,
    private readonly grades: GradesRepository,
    private readonly assessments: AssessmentsService,
    private readonly gradingScales: GradingScalesService,
    private readonly coursesClient: CoursesClient,
    private readonly enrollmentClient: EnrollmentClient,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly locks: RedisLockService,
  ) {}

  // ─── Compute final results for a course/term ───────────────────────────

  async computeAndPersistCourseTerm(
    courseId: string,
    academicTerm: string,
    actor: JwtPayload,
  ): Promise<ComputedResult[]> {
    const course = await this.coursesClient.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const courseCredits = Number(course.credits || 0);

    const allAssessments = (
      await this.assessments.findForCourseTerm(courseId, academicTerm)
    ).filter((a) => a.status !== 'ARCHIVED');

    const totalWeight = allAssessments.reduce(
      (s, a) => s + Number(a.weightPercentage),
      0,
    );
    if (totalWeight <= 0) {
      throw new BadRequestException(
        'No active assessments configured for this course/term',
      );
    }

    const roster = await this.enrollmentClient.getRoster(
      courseId,
      academicTerm,
    );
    if (!roster.length) {
      throw new BadRequestException(
        'Enrollment service returned no roster for this course/term',
      );
    }

    const passPct = this.config.get<number>('app.defaultPassPercentage') ?? 50;
    const computed: ComputedResult[] = [];

    for (const r of roster) {
      // Withdrawn students do not get a normal final grade
      if (r.status === 'WITHDRAWN' || r.status === 'DROPPED') {
        const result = await this.repo.upsert({
          studentId: r.studentId,
          courseId,
          academicTerm,
          enrollmentId: r.id,
          weightedScore: new Prisma.Decimal(0),
          letterGrade: 'W',
          gradePoints: new Prisma.Decimal(0),
          creditsEarned: new Prisma.Decimal(0),
          resultStatus: ResultStatus.WITHDRAWN,
        });
        computed.push({
          studentId: result.studentId,
          enrollmentId: result.enrollmentId,
          weightedScore: 0,
          letterGrade: 'W',
          gradePoints: 0,
          creditsEarned: 0,
          resultStatus: ResultStatus.WITHDRAWN,
        });
        continue;
      }

      if (r.status !== 'ENROLLED' && r.status !== 'COMPLETED') {
        continue;
      }

      const studentGrades = await this.grades.findPublishedByStudentCourseTerm(
        r.studentId,
        courseId,
        academicTerm,
      );

      const weighted = this.computeWeightedScore(studentGrades, allAssessments);
      // If the student has no published grades at all, mark INCOMPLETE
      if (!studentGrades.length) {
        const result = await this.repo.upsert({
          studentId: r.studentId,
          courseId,
          academicTerm,
          enrollmentId: r.id,
          weightedScore: new Prisma.Decimal(0),
          letterGrade: 'I',
          gradePoints: new Prisma.Decimal(0),
          creditsEarned: new Prisma.Decimal(0),
          resultStatus: ResultStatus.INCOMPLETE,
        });
        computed.push({
          studentId: result.studentId,
          enrollmentId: result.enrollmentId,
          weightedScore: 0,
          letterGrade: 'I',
          gradePoints: 0,
          creditsEarned: 0,
          resultStatus: ResultStatus.INCOMPLETE,
        });
        continue;
      }

      const { letterGrade, gradePoints } =
        await this.gradingScales.resolveLetterGrade(weighted);
      const passed = weighted >= passPct;
      const status = passed ? ResultStatus.PASS : ResultStatus.FAIL;
      const earned = passed ? courseCredits : 0;

      const saved = await this.repo.upsert({
        studentId: r.studentId,
        courseId,
        academicTerm,
        enrollmentId: r.id,
        weightedScore: new Prisma.Decimal(weighted),
        letterGrade,
        gradePoints: new Prisma.Decimal(gradePoints),
        creditsEarned: new Prisma.Decimal(earned),
        resultStatus: status,
      });

      computed.push({
        studentId: saved.studentId,
        enrollmentId: saved.enrollmentId,
        weightedScore: weighted,
        letterGrade,
        gradePoints,
        creditsEarned: earned,
        resultStatus: status,
      });
    }

    await this.auditLog.log({
      userId: actor.sub,
      action: 'results.computed',
      entity: 'FinalCourseResult',
      entityId: courseId,
      metadata: { courseId, academicTerm, count: computed.length },
    });

    return computed;
  }

  // ─── Publish per course (transactional) ────────────────────────────────

  async publishCourseTerm(
    courseId: string,
    academicTerm: string,
    actor: JwtPayload,
    ip?: string,
  ) {
    if (actor.role === 'Teacher') {
      const allowTeacher =
        this.config.get<boolean>('app.allowTeacherPublish') ?? false;
      if (!allowTeacher) {
        throw new ForbiddenException(
          'Teachers are not authorized to publish results in this deployment',
        );
      }
      const ok = await this.coursesClient.isTeacherAssignedToCourse(
        actor.sub,
        courseId,
        academicTerm,
      );
      if (!ok) {
        throw new ForbiddenException('Teacher is not assigned to this course/term');
      }
    } else if (actor.role !== 'Admin') {
      throw new ForbiddenException('Only Admins (or authorized Teachers) can publish');
    }

    return this.locks.withLock(`results:${academicTerm}:${courseId}`, () =>
     this.prisma.$transaction(async (tx) => {
      // 1. Recompute (writes draft results rows)
      const computed = await this.computeAndPersistCourseTerm(
        courseId,
        academicTerm,
        actor,
      );

      // 2. Publish all draft grades for the course/term
      await tx.grade.updateMany({
        where: {
          status: GradeStatus.DRAFT,
          assessment: { courseId, academicTerm },
        },
        data: { status: GradeStatus.PUBLISHED },
      });

      // 3. Stamp publishedAt on results
      await tx.finalCourseResult.updateMany({
        where: { courseId, academicTerm, publishedAt: null },
        data: { publishedAt: new Date() },
      });

      await this.auditLog.log({
        userId: actor.sub,
        action: 'results.course_published',
        entity: 'FinalCourseResult',
        entityId: courseId,
        ipAddress: ip,
        metadata: { courseId, academicTerm, count: computed.length },
      });

      this.events.publish(GRADE_EVENTS.PUBLISHED, {
        scope: 'course-term',
        courseId,
        academicTerm,
        count: computed.length,
      });

      this.events.publish(RESULT_EVENTS.COURSE_PUBLISHED, {
        courseId,
        academicTerm,
        count: computed.length,
      });

      return { courseId, academicTerm, count: computed.length, results: computed };
     }),
    );
  }

  // ─── Publish whole term (admin only) ───────────────────────────────────

  async publishTerm(academicTerm: string, actor: JwtPayload, ip?: string) {
    if (actor.role !== 'Admin') {
      throw new ForbiddenException('Only Admin can publish a term');
    }

    return this.locks.withLock(`results:term:${academicTerm}`, () =>
     this.prisma.$transaction(async (tx) => {
      // distinct courseIds in this term
      const distinctCourses = await tx.assessment.findMany({
        where: { academicTerm, status: { not: 'ARCHIVED' } },
        select: { courseId: true },
        distinct: ['courseId'],
      });

      let total = 0;
      for (const { courseId } of distinctCourses) {
        const computed = await this.computeAndPersistCourseTerm(
          courseId,
          academicTerm,
          actor,
        );
        total += computed.length;
      }

      await tx.grade.updateMany({
        where: {
          status: GradeStatus.DRAFT,
          assessment: { academicTerm },
        },
        data: { status: GradeStatus.PUBLISHED },
      });

      await tx.finalCourseResult.updateMany({
        where: { academicTerm, publishedAt: null },
        data: { publishedAt: new Date() },
      });

      await this.auditLog.log({
        userId: actor.sub,
        action: 'results.term_published',
        entity: 'FinalCourseResult',
        entityId: academicTerm,
        ipAddress: ip,
        metadata: { academicTerm, courseCount: distinctCourses.length, total },
      });

      this.events.publish(RESULT_EVENTS.TERM_PUBLISHED, {
        academicTerm,
        courseCount: distinctCourses.length,
        resultCount: total,
      });

      return {
        academicTerm,
        courseCount: distinctCourses.length,
        resultCount: total,
      };
     }),
    );
  }

  // ─── Reads ─────────────────────────────────────────────────────────────

  list = (filters: Parameters<ResultsRepository['list']>[0]) =>
    this.repo.list(filters);

  findByStudent = (studentId: string, term?: string) =>
    this.repo.findByStudent(studentId, term);

  findCompletedByStudent = (studentId: string) =>
    this.repo.findCompletedByStudent(studentId);

  findByCourseTerm = (courseId: string, term: string) =>
    this.repo.findByCourseTerm(courseId, term);

  // ─── Pure calculation (testable) ───────────────────────────────────────

  private computeWeightedScore(
    grades: Array<{ assessmentId: string; percentageScore: Prisma.Decimal }>,
    assessments: Assessment[],
  ): number {
    const byId = new Map(assessments.map((a) => [a.id, a]));
    let weighted = 0;
    for (const g of grades) {
      const a = byId.get(g.assessmentId);
      if (!a) continue;
      weighted += (Number(g.percentageScore) * Number(a.weightPercentage)) / 100;
    }
    return Math.round(weighted * 100) / 100;
  }
}
