import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  EnrollmentSource,
  EnrollmentStatus,
  GradingOption,
  Prisma,
} from '@prisma/client';

import { EnrollmentsRepository } from './enrollments.repository';
import { CapacityService } from '../capacity/capacity.service';
import { CapacityRepository } from '../capacity/capacity.repository';
import { WaitlistsService } from '../waitlists/waitlists.service';
import { RegistrationWindowsService } from '../registration-windows/registration-windows.service';
import { PrismaService } from '../database/prisma.service';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import {
  COURSE_CAPACITY_EVENTS,
  ENROLLMENT_EVENTS,
  STUDENT_LOAD_EVENTS,
  WAITLIST_EVENTS,
} from '../events/event-names';
import { RedisLockService } from '../locks/locks.module';
import { StudentsClient } from '../clients/students.client';
import { CoursesClient } from '../clients/courses.client';
import { GradesClient } from '../clients/grades.client';
import {
  BulkCreateEnrollmentDto,
  CreateEnrollmentDto,
  DropEnrollmentDto,
  ForceDropDto,
  ForceEnrollDto,
  UpdateEnrollmentStatusDto,
} from './dto/enrollment.dto';
import { EnrollmentFilterDto } from './dto/enrollment-filter.dto';
import { buildPaginated } from '../common/dto/pagination.dto';

export interface EnrollmentResult {
  outcome: 'ENROLLED' | 'WAITLISTED';
  enrollmentId?: string;
  waitlistId?: string;
  position?: number;
}

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);
  private readonly maxStandardCredits: number;
  private readonly maxOverloadCredits: number;
  private readonly enablePrerequisiteCheck: boolean;

  constructor(
    private readonly repo: EnrollmentsRepository,
    private readonly capacity: CapacityService,
    private readonly capacityRepo: CapacityRepository,
    private readonly waitlists: WaitlistsService,
    private readonly windows: RegistrationWindowsService,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
    private readonly locks: RedisLockService,
    private readonly studentsClient: StudentsClient,
    private readonly coursesClient: CoursesClient,
    private readonly gradesClient: GradesClient,
    config: ConfigService,
  ) {
    this.maxStandardCredits =
      config.get<number>('app.maxStandardCredits') || 18;
    this.maxOverloadCredits =
      config.get<number>('app.maxOverloadCredits') || 24;
    this.enablePrerequisiteCheck =
      config.get<boolean>('app.enablePrerequisiteCheck') ?? true;
  }

  // ─── Reads ─────────────────────────────────────────────────────────────

  async findById(id: string, includeAuditLogs = false) {
    const e = await this.repo.findById(id, includeAuditLogs);
    if (!e) throw new NotFoundException('Enrollment not found');
    return e;
  }

  async list(filters: EnrollmentFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const [items, total] = await this.repo.list({
      studentId: filters.studentId,
      courseId: filters.courseId,
      academicTerm: filters.academicTerm,
      sectionCode: filters.sectionCode,
      status: filters.status,
      source: filters.source,
      page,
      limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      includeAuditLogs: filters.includeAuditLogs === 'true',
    });
    return buildPaginated(items, total, page, limit);
  }

  listForStudent(studentId: string, academicTerm?: string) {
    return this.repo.listForStudent(studentId, academicTerm);
  }

  /**
   * Total credits the student is currently committed to in the given term.
   * Used by both the credit-load enforcement and the internal API exposed
   * to other services (e.g. AI Agent, Finance).
   */
  currentLoad(studentId: string, academicTerm: string) {
    return this.repo.currentLoad(studentId, academicTerm);
  }

  // ─── Self-service enrollment ───────────────────────────────────────────

  async createSelfService(
    studentId: string,
    dto: CreateEnrollmentDto,
    actor: JwtPayload,
    ip?: string,
  ): Promise<EnrollmentResult> {
    return this.enroll({
      studentId,
      courseId: dto.courseId,
      academicTerm: dto.academicTerm,
      sectionCode: dto.sectionCode ?? null,
      gradingOption: dto.gradingOption ?? GradingOption.LETTER,
      joinWaitlistIfFull: dto.joinWaitlistIfFull ?? true,
      source: EnrollmentSource.SELF_SERVICE,
      actor,
      ip,
    });
  }

  async createBulkSelfService(
    studentId: string,
    dto: BulkCreateEnrollmentDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const results: Array<{
      courseId: string;
      result?: EnrollmentResult;
      error?: string;
    }> = [];
    for (const item of dto.items) {
      try {
        const r = await this.enroll({
          studentId,
          courseId: item.courseId,
          academicTerm: dto.academicTerm,
          sectionCode: item.sectionCode ?? null,
          gradingOption: item.gradingOption ?? GradingOption.LETTER,
          joinWaitlistIfFull: item.joinWaitlistIfFull ?? true,
          source: EnrollmentSource.SELF_SERVICE,
          actor,
          ip,
        });
        results.push({ courseId: item.courseId, result: r });
      } catch (err) {
        results.push({
          courseId: item.courseId,
          error: (err as Error).message,
        });
      }
    }
    return { academicTerm: dto.academicTerm, results };
  }

  // ─── Admin force enrollment ────────────────────────────────────────────

  async forceEnroll(dto: ForceEnrollDto, actor: JwtPayload, ip?: string) {
    const r = await this.enroll({
      studentId: dto.studentId,
      courseId: dto.courseId,
      academicTerm: dto.academicTerm,
      sectionCode: dto.sectionCode ?? null,
      gradingOption: dto.gradingOption ?? GradingOption.LETTER,
      joinWaitlistIfFull: false,
      source: EnrollmentSource.ADMIN,
      actor,
      ip,
      ignoreCapacity: dto.ignoreCapacity ?? false,
      overrideReason: dto.reason,
    });

    this.events.publish(ENROLLMENT_EVENTS.OVERRIDE, {
      enrollmentId: r.enrollmentId,
      studentId: dto.studentId,
      courseId: dto.courseId,
      academicTerm: dto.academicTerm,
      reason: dto.reason,
      adminUserId: actor.sub,
    });

    return r;
  }

  async forceDrop(dto: ForceDropDto, actor: JwtPayload, ip?: string) {
    return this.dropById(
      dto.enrollmentId,
      { reason: dto.reason },
      actor,
      ip,
      true,
    );
  }

  // ─── Drop / withdraw ───────────────────────────────────────────────────

  async dropById(
    id: string,
    dto: DropEnrollmentDto,
    actor: JwtPayload,
    ip?: string,
    isAdminOverride = false,
  ) {
    const enrollment = await this.repo.findById(id);
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (
      !isAdminOverride &&
      actor.role !== 'Admin' &&
      enrollment.studentId !== actor.sub
    ) {
      throw new ForbiddenException(
        'You can only drop your own enrollments',
      );
    }

    if (
      enrollment.status === EnrollmentStatus.DROPPED ||
      enrollment.status === EnrollmentStatus.WITHDRAWN ||
      enrollment.status === EnrollmentStatus.COMPLETED ||
      enrollment.status === EnrollmentStatus.FAILED
    ) {
      throw new BadRequestException(
        `Enrollment is already in status ${enrollment.status}`,
      );
    }

    let nextStatus: EnrollmentStatus;
    if (isAdminOverride) {
      nextStatus = EnrollmentStatus.DROPPED;
    } else {
      const phase = await this.windows.assertCanDrop(
        actor,
        enrollment.academicTerm,
      );
      nextStatus =
        phase === 'drop'
          ? EnrollmentStatus.DROPPED
          : EnrollmentStatus.WITHDRAWN;
    }

    const result = await this.locks.withLock(
      `enroll:${enrollment.courseId}:${enrollment.academicTerm}:${enrollment.sectionCode ?? '*'}`,
      async () => {
        return this.prisma.$transaction(async (tx) => {
          const updated = await this.repo.update(
            id,
            {
              status: nextStatus,
              droppedAt: new Date(),
              dropReason: dto.reason,
              ...(isAdminOverride
                ? { overrideReason: dto.reason }
                : {}),
            },
            tx,
          );

          // Free the seat if it was previously taken.
          if (enrollment.status === EnrollmentStatus.ENROLLED) {
            const snap = await this.capacityRepo.findOneForUpdate(
              enrollment.courseId,
              enrollment.academicTerm,
              enrollment.sectionCode,
              tx,
            );
            if (snap && snap.seatsTaken > 0) {
              await this.capacityRepo.incrementSeats(snap.id, -1, tx);
            }
          }

          await tx.enrollmentAuditLog.create({
            data: {
              enrollmentId: id,
              actorUserId: actor.sub,
              action:
                nextStatus === EnrollmentStatus.WITHDRAWN
                  ? AuditAction.WITHDRAWN
                  : isAdminOverride
                    ? AuditAction.OVERRIDE
                    : AuditAction.DROPPED,
              metadataJson: {
                from: enrollment.status,
                to: nextStatus,
                reason: dto.reason ?? null,
                isAdminOverride,
              },
              ipAddress: ip,
            },
          });

          // Try to promote the next waitlist entry (best effort, same tx).
          if (
            enrollment.status === EnrollmentStatus.ENROLLED &&
            nextStatus !== EnrollmentStatus.WITHDRAWN
          ) {
            await this.waitlists.promoteNext(
              enrollment.courseId,
              enrollment.academicTerm,
              enrollment.sectionCode,
              tx,
            );
          }

          return updated;
        });
      },
    );

    if (nextStatus === EnrollmentStatus.WITHDRAWN) {
      this.events.publish(ENROLLMENT_EVENTS.WITHDRAWN, {
        enrollmentId: id,
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        academicTerm: enrollment.academicTerm,
        reason: dto.reason ?? null,
      });
    } else {
      this.events.publish(ENROLLMENT_EVENTS.DROPPED, {
        enrollmentId: id,
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        academicTerm: enrollment.academicTerm,
        isAdminOverride,
        reason: dto.reason ?? null,
      });
    }

    return result;
  }

  // ─── Status patch (Admin) ──────────────────────────────────────────────

  async updateStatus(
    id: string,
    dto: UpdateEnrollmentStatusDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Enrollment not found');
    if (existing.status === dto.status) return existing;

    const updated = await this.prisma.$transaction(async (tx) => {
      const e = await this.repo.update(
        id,
        {
          status: dto.status,
          ...(dto.status === EnrollmentStatus.DROPPED ||
          dto.status === EnrollmentStatus.WITHDRAWN
            ? { droppedAt: new Date(), dropReason: dto.reason }
            : {}),
        },
        tx,
      );
      await tx.enrollmentAuditLog.create({
        data: {
          enrollmentId: id,
          actorUserId: actor.sub,
          action: AuditAction.STATUS_CHANGED,
          metadataJson: {
            from: existing.status,
            to: dto.status,
            reason: dto.reason ?? null,
          },
          ipAddress: ip,
        },
      });

      // Adjust seat counters when transitioning into/out of ENROLLED.
      const wasEnrolled = existing.status === EnrollmentStatus.ENROLLED;
      const willBeEnrolled = dto.status === EnrollmentStatus.ENROLLED;
      if (wasEnrolled !== willBeEnrolled) {
        const snap = await this.capacityRepo.findOneForUpdate(
          existing.courseId,
          existing.academicTerm,
          existing.sectionCode,
          tx,
        );
        if (snap) {
          const delta = willBeEnrolled ? 1 : -1;
          if (delta < 0 && snap.seatsTaken > 0) {
            await this.capacityRepo.incrementSeats(snap.id, -1, tx);
          } else if (delta > 0) {
            if (snap.seatsTaken + snap.seatsReserved >= snap.capacityTotal) {
              throw new ConflictException(
                'Cannot move to ENROLLED: course is full',
              );
            }
            await this.capacityRepo.incrementSeats(snap.id, 1, tx);
          }
        }
      }
      return e;
    });

    this.events.publish(ENROLLMENT_EVENTS.STATUS_CHANGED, {
      enrollmentId: id,
      studentId: existing.studentId,
      courseId: existing.courseId,
      academicTerm: existing.academicTerm,
      from: existing.status,
      to: dto.status,
    });

    return updated;
  }

  // ─── Core enrollment flow ──────────────────────────────────────────────

  /**
   * Single-source-of-truth enrollment routine. Wraps the entire
   * (validate → reserve seat → write row → maybe waitlist) pipeline in:
   *   1. a Redis distributed lock keyed by (course, term, section) to
   *      serialize across processes
   *   2. a database transaction with FOR UPDATE locks on the capacity
   *      snapshot row to serialize across replicas
   */
  private async enroll(args: {
    studentId: string;
    courseId: string;
    academicTerm: string;
    sectionCode: string | null;
    gradingOption: GradingOption;
    joinWaitlistIfFull: boolean;
    source: EnrollmentSource;
    actor: JwtPayload;
    ip?: string;
    ignoreCapacity?: boolean;
    overrideReason?: string;
  }): Promise<EnrollmentResult> {
    // 1. Verify registration window (admin overrides bypass).
    if (args.source !== EnrollmentSource.ADMIN) {
      await this.windows.assertOpenForActor(args.actor, args.academicTerm);
    }

    // 2. Verify student status.
    const student = await this.studentsClient.findById(args.studentId);
    if (!student) {
      // Soft-fail when Students Service is unreachable; admins can still force.
      if (args.source !== EnrollmentSource.ADMIN) {
        throw new BadRequestException(
          'Student record could not be verified',
        );
      }
    } else if (
      student.status &&
      student.status !== 'ACTIVE' &&
      args.source !== EnrollmentSource.ADMIN
    ) {
      throw new ForbiddenException(
        `Student status (${student.status}) does not permit enrollment`,
      );
    }

    // 3. Verify course is active and load credits.
    const course = await this.coursesClient.findById(args.courseId);
    if (!course) {
      throw new NotFoundException('Course not found in catalog');
    }
    if (course.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Course is in status ${course.status} and cannot accept enrollments`,
      );
    }

    // 4. Prerequisites.
    if (this.enablePrerequisiteCheck) {
      await this.assertPrerequisitesSatisfied(args.studentId, args.courseId);
    }

    // 5. Duplicate enrollment.
    const dup = await this.repo.findActiveForStudent(
      args.studentId,
      args.courseId,
      args.academicTerm,
    );
    if (dup) {
      throw new ConflictException(
        `Student already has an active enrollment for this course (status=${dup.status})`,
      );
    }

    // 6. Credit load.
    const currentLoad = await this.repo.currentLoad(
      args.studentId,
      args.academicTerm,
    );
    const incoming = currentLoad + Number(course.credits ?? 0);
    const limit =
      args.source === EnrollmentSource.ADMIN
        ? this.maxOverloadCredits
        : this.maxStandardCredits;
    if (incoming > limit) {
      throw new ForbiddenException(
        `Credit load ${incoming} exceeds limit ${limit}. ${
          args.source === EnrollmentSource.ADMIN
            ? 'Even admin overload cap exceeded.'
            : 'Request advisor override.'
        }`,
      );
    }
    if (incoming > this.maxStandardCredits) {
      this.events.publish(STUDENT_LOAD_EVENTS.OVERLOADED, {
        studentId: args.studentId,
        academicTerm: args.academicTerm,
        totalCredits: incoming,
        threshold: this.maxStandardCredits,
      });
    }

    // 7-10. Locked transaction for seat allocation + write.
    const lockKey = `enroll:${args.courseId}:${args.academicTerm}:${args.sectionCode ?? '*'}`;

    const result = await this.locks.withLock<EnrollmentResult>(
      lockKey,
      async () =>
        this.prisma.$transaction<EnrollmentResult>(async (tx) => {
          await this.capacity.ensureSnapshot(
            args.courseId,
            args.academicTerm,
            args.sectionCode,
            tx,
          );
          const snap = await this.capacityRepo.findOneForUpdate(
            args.courseId,
            args.academicTerm,
            args.sectionCode,
            tx,
          );
          if (!snap) {
            throw new BadRequestException(
              'Capacity snapshot could not be initialized',
            );
          }

          const seatsAvailable =
            snap.capacityTotal - snap.seatsTaken - snap.seatsReserved;
          const hasSeat = seatsAvailable > 0 || args.ignoreCapacity;

          if (hasSeat) {
            const enrollment = await this.repo.create(
              {
                studentId: args.studentId,
                courseId: args.courseId,
                academicTerm: args.academicTerm,
                sectionCode: args.sectionCode,
                status: EnrollmentStatus.ENROLLED,
                source: args.source,
                creditsSnapshot: new Prisma.Decimal(course.credits ?? 0),
                gradingOption: args.gradingOption,
                createdByUserId: args.actor.sub,
                overrideReason: args.overrideReason,
              },
              tx,
            );
            if (!args.ignoreCapacity) {
              await this.capacityRepo.incrementSeats(snap.id, 1, tx);
            }

            await tx.enrollmentAuditLog.create({
              data: {
                enrollmentId: enrollment.id,
                actorUserId: args.actor.sub,
                action:
                  args.source === EnrollmentSource.ADMIN
                    ? AuditAction.OVERRIDE
                    : AuditAction.ENROLLED,
                metadataJson: {
                  source: args.source,
                  ignoreCapacity: !!args.ignoreCapacity,
                  reason: args.overrideReason ?? null,
                },
                ipAddress: args.ip,
              },
            });

            // Capacity-full event is fire-and-forget (post-tx).
            const willBeFull =
              snap.seatsTaken + 1 + snap.seatsReserved >= snap.capacityTotal;

            return {
              outcome: 'ENROLLED',
              enrollmentId: enrollment.id,
              _willBeFull: willBeFull,
            } as EnrollmentResult & { _willBeFull?: boolean };
          }

          // No seat: waitlist or fail
          if (!args.joinWaitlistIfFull) {
            throw new ConflictException(
              'Course is full; pass joinWaitlistIfFull=true to be added to the waitlist',
            );
          }

          const position = await (async () => {
            // Reuse the FOR UPDATE position fetch from waitlists repo.
            const max = await tx.waitlist.aggregate({
              where: {
                courseId: args.courseId,
                academicTerm: args.academicTerm,
                sectionCode: args.sectionCode,
                status: 'ACTIVE',
              },
              _max: { position: true },
            });
            return (max._max.position ?? 0) + 1;
          })();

          const w = await tx.waitlist.create({
            data: {
              studentId: args.studentId,
              courseId: args.courseId,
              academicTerm: args.academicTerm,
              sectionCode: args.sectionCode,
              position,
              priorityScore: 0,
              status: 'ACTIVE',
            },
          });
          await this.capacityRepo.incrementWaitlist(snap.id, 1, tx);

          return {
            outcome: 'WAITLISTED',
            waitlistId: w.id,
            position,
            _wasFull: true,
          } as EnrollmentResult & { _wasFull?: boolean };
        }),
    );

    // ─── Post-transaction side effects ───────────────────────────────────
    if (result.outcome === 'ENROLLED' && result.enrollmentId) {
      this.events.publish(ENROLLMENT_EVENTS.CREATED, {
        enrollmentId: result.enrollmentId,
        studentId: args.studentId,
        courseId: args.courseId,
        academicTerm: args.academicTerm,
        sectionCode: args.sectionCode,
        credits: Number(course.credits ?? 0),
        source: args.source,
      });
      if ((result as { _willBeFull?: boolean })._willBeFull) {
        this.events.publish(COURSE_CAPACITY_EVENTS.FULL, {
          courseId: args.courseId,
          academicTerm: args.academicTerm,
          sectionCode: args.sectionCode,
        });
      }
    } else if (result.outcome === 'WAITLISTED' && result.waitlistId) {
      this.events.publish(WAITLIST_EVENTS.JOINED, {
        waitlistId: result.waitlistId,
        studentId: args.studentId,
        courseId: args.courseId,
        academicTerm: args.academicTerm,
        position: result.position,
      });
    }

    await this.auditLog.log({
      userId: args.actor.sub,
      action:
        result.outcome === 'ENROLLED'
          ? 'enrollment.created'
          : 'waitlist.joined',
      entity: 'Enrollment',
      entityId: result.enrollmentId ?? result.waitlistId,
      ipAddress: args.ip,
      metadata: {
        studentId: args.studentId,
        courseId: args.courseId,
        academicTerm: args.academicTerm,
        source: args.source,
      },
    });

    // Strip private flags before returning.
    const { _willBeFull, _wasFull, ...clean } = result as EnrollmentResult & {
      _willBeFull?: boolean;
      _wasFull?: boolean;
    };
    void _willBeFull;
    void _wasFull;
    return clean;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async assertPrerequisitesSatisfied(
    studentId: string,
    courseId: string,
  ) {
    const rules = await this.coursesClient.getEligibilityRules(courseId);
    if (!rules || !rules.prerequisites?.length) return;

    const required = rules.prerequisites.filter(
      (p) => p.type === 'REQUIRED',
    );
    if (required.length === 0) return;

    const completed = await this.gradesClient.listCompletedCourses(studentId);
    const completedIds = new Set(
      completed.filter((c) => c.passed).map((c) => c.courseId),
    );

    const missing = required
      .filter((p) => !completedIds.has(p.prerequisiteCourseId))
      .map((p) => p.prerequisiteCourseCode || p.prerequisiteCourseId);

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required prerequisites: ${missing.join(', ')}`,
      );
    }
  }
}
