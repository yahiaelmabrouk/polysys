import { Injectable, Logger } from '@nestjs/common';
import {
  AcademicStanding,
  FinalCourseResult,
  Prisma,
  ResultStatus,
} from '@prisma/client';
import { GpaRepository } from './gpa.repository';
import { ResultsService } from '../results/results.service';
import { CoursesClient } from '../clients/courses.client';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import {
  GPA_EVENTS,
  STUDENT_RISK_EVENTS,
} from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';

interface TermBucket {
  academicTerm: string;
  attempted: number;
  earned: number;
  qualityPoints: number;
}

@Injectable()
export class GpaService {
  private readonly logger = new Logger(GpaService.name);

  constructor(
    private readonly repo: GpaRepository,
    private readonly results: ResultsService,
    private readonly coursesClient: CoursesClient,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  // ─── Reads ─────────────────────────────────────────────────────────────

  getStudentSnapshots(studentId: string) {
    return this.repo.findByStudent(studentId);
  }

  getLatest(studentId: string) {
    return this.repo.findLatestByStudent(studentId);
  }

  getStudentTerm(studentId: string, term: string) {
    return this.repo.findByStudentTerm(studentId, term);
  }

  // ─── Recalculation ─────────────────────────────────────────────────────

  async recalculateForStudent(
    studentId: string,
    actor: JwtPayload,
    ip?: string,
  ) {
    const completed = await this.results.findCompletedByStudent(studentId);
    if (!completed.length) {
      return { studentId, snapshots: [] };
    }

    const buckets = await this.bucketByTerm(completed);
    const sortedTerms = Object.keys(buckets).sort();

    let cumulativeAttempted = 0;
    let cumulativeQuality = 0;
    let cumulativeEarned = 0;

    const snapshots = [];
    let previousStanding: AcademicStanding | null = null;
    for (const term of sortedTerms) {
      const b = buckets[term];
      cumulativeAttempted += b.attempted;
      cumulativeQuality += b.qualityPoints;
      cumulativeEarned += b.earned;

      const termGpa = b.attempted > 0 ? b.qualityPoints / b.attempted : 0;
      const cumGpa =
        cumulativeAttempted > 0
          ? cumulativeQuality / cumulativeAttempted
          : 0;
      const standing = this.classifyStanding(cumGpa);

      const saved = await this.repo.upsert({
        studentId,
        academicTerm: term,
        termGpa: new Prisma.Decimal(round2(termGpa)),
        cumulativeGpa: new Prisma.Decimal(round2(cumGpa)),
        creditsAttempted: new Prisma.Decimal(round2(cumulativeAttempted)),
        creditsEarned: new Prisma.Decimal(round2(cumulativeEarned)),
        academicStanding: standing,
      });
      snapshots.push(saved);

      this.events.publish(GPA_EVENTS.UPDATED, {
        studentId,
        academicTerm: term,
        termGpa: round2(termGpa),
        cumulativeGpa: round2(cumGpa),
        creditsAttempted: round2(cumulativeAttempted),
        creditsEarned: round2(cumulativeEarned),
        academicStanding: standing,
      });

      if (previousStanding && previousStanding !== standing) {
        this.events.publish(GPA_EVENTS.STANDING_CHANGED, {
          studentId,
          academicTerm: term,
          from: previousStanding,
          to: standing,
        });
      }

      if (
        standing === AcademicStanding.PROBATION ||
        standing === AcademicStanding.WARNING
      ) {
        this.events.publish(STUDENT_RISK_EVENTS.AT_RISK_DETECTED, {
          studentId,
          academicTerm: term,
          cumulativeGpa: round2(cumGpa),
          standing,
        });
      }

      previousStanding = standing;
    }

    await this.auditLog.log({
      userId: actor.sub,
      action: 'gpa.recalculated',
      entity: 'GpaSnapshot',
      entityId: studentId,
      ipAddress: ip,
      metadata: { terms: sortedTerms },
    });

    return { studentId, snapshots };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async bucketByTerm(
    results: FinalCourseResult[],
  ): Promise<Record<string, TermBucket>> {
    const buckets: Record<string, TermBucket> = {};
    // Resolve credits per courseId (cache per call)
    const creditsByCourse = new Map<string, number>();

    for (const r of results) {
      if (
        r.resultStatus !== ResultStatus.PASS &&
        r.resultStatus !== ResultStatus.FAIL
      ) {
        // INCOMPLETE / WITHDRAWN do not count toward attempted credits
        continue;
      }

      let courseCredits = creditsByCourse.get(r.courseId);
      if (courseCredits === undefined) {
        const course = await this.coursesClient.findById(r.courseId);
        courseCredits = Number(course?.credits ?? 0);
        creditsByCourse.set(r.courseId, courseCredits);
      }

      // Prefer the snapshotted creditsEarned for earned-credit accuracy
      const earned = Number(r.creditsEarned ?? 0);
      const attempted = courseCredits;
      const points = Number(r.gradePoints) * attempted;

      const bucket =
        buckets[r.academicTerm] ??
        (buckets[r.academicTerm] = {
          academicTerm: r.academicTerm,
          attempted: 0,
          earned: 0,
          qualityPoints: 0,
        });
      bucket.attempted += attempted;
      bucket.earned += earned;
      bucket.qualityPoints += points;
    }
    return buckets;
  }

  /**
   * Maps cumulative GPA to academic standing.
   * Examples: Honors >= 3.5, Good >= 2.0, Warning >= 1.5, else Probation.
   */
  private classifyStanding(cumGpa: number): AcademicStanding {
    if (cumGpa >= 3.5) return AcademicStanding.HONORS;
    if (cumGpa >= 2.0) return AcademicStanding.GOOD;
    if (cumGpa >= 1.5) return AcademicStanding.WARNING;
    return AcademicStanding.PROBATION;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
