import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Prisma, WaitlistStatus } from '@prisma/client';
import { WaitlistsRepository } from './waitlists.repository';
import { CapacityService } from '../capacity/capacity.service';
import { CapacityRepository } from '../capacity/capacity.repository';
import { PrismaService } from '../database/prisma.service';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { WAITLIST_EVENTS } from '../events/event-names';
import { RedisLockService } from '../locks/locks.module';
import { JoinWaitlistDto } from './dto/waitlist.dto';
import { buildPaginated } from '../common/dto/pagination.dto';

@Injectable()
export class WaitlistsService {
  private readonly logger = new Logger(WaitlistsService.name);
  private readonly reservationTtlHours: number;

  constructor(
    private readonly repo: WaitlistsRepository,
    private readonly capacity: CapacityService,
    private readonly capacityRepo: CapacityRepository,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
    private readonly locks: RedisLockService,
    config: ConfigService,
  ) {
    this.reservationTtlHours =
      config.get<number>('app.waitlistReservationTtlHours') || 48;
  }

  // ─── Read ──────────────────────────────────────────────────────────────

  async listForStudent(studentId: string) {
    const items = await this.repo.listForStudent(
      studentId,
      WaitlistStatus.ACTIVE,
    );
    return items.map((w) => ({
      ...w,
      currentPosition: w.position,
    }));
  }

  async listForCourse(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null | undefined,
    page = 1,
    limit = 20,
  ) {
    const [items, total] = await this.repo.listForCourse(
      courseId,
      academicTerm,
      sectionCode,
      page,
      limit,
    );
    return buildPaginated(items, total, page, limit);
  }

  // ─── Join ──────────────────────────────────────────────────────────────

  async join(
    courseId: string,
    studentId: string,
    dto: JoinWaitlistDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const sectionCode = dto.sectionCode ?? null;

    return this.locks.withLock(
      `waitlist:${courseId}:${dto.academicTerm}:${sectionCode ?? '*'}`,
      async () => {
        const existing = await this.repo.findActiveForStudent(
          studentId,
          courseId,
          dto.academicTerm,
        );
        if (existing) {
          throw new ConflictException('Student is already on the waitlist');
        }

        const created = await this.prisma.$transaction(async (tx) => {
          await this.capacity.ensureSnapshot(
            courseId,
            dto.academicTerm,
            sectionCode,
            tx,
          );
          const position = await this.repo.nextPosition(
            courseId,
            dto.academicTerm,
            sectionCode,
            tx,
          );
          const w = await this.repo.create(
            {
              studentId,
              courseId,
              academicTerm: dto.academicTerm,
              sectionCode,
              position,
              priorityScore: dto.priorityScore ?? 0,
              status: WaitlistStatus.ACTIVE,
            },
            tx,
          );
          const snapshot = await this.capacityRepo.findOneForUpdate(
            courseId,
            dto.academicTerm,
            sectionCode,
            tx,
          );
          if (snapshot) {
            await this.capacityRepo.incrementWaitlist(snapshot.id, 1, tx);
          }
          return w;
        });

        await this.auditLog.log({
          userId: actor.sub,
          action: 'waitlist.joined',
          entity: 'Waitlist',
          entityId: created.id,
          ipAddress: ip,
          metadata: {
            courseId,
            academicTerm: dto.academicTerm,
            position: created.position,
          },
        });

        this.events.publish(WAITLIST_EVENTS.JOINED, {
          waitlistId: created.id,
          studentId: created.studentId,
          courseId: created.courseId,
          academicTerm: created.academicTerm,
          position: created.position,
        });

        return created;
      },
    );
  }

  // ─── Leave ─────────────────────────────────────────────────────────────

  async leave(id: string, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Waitlist entry not found');

    if (
      actor.role !== 'Admin' &&
      existing.studentId !== actor.sub
    ) {
      throw new ForbiddenException(
        'You can only leave waitlists you joined yourself',
      );
    }

    if (existing.status !== WaitlistStatus.ACTIVE) {
      throw new BadRequestException(
        `Waitlist entry is already in status ${existing.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const w = await this.repo.update(
        id,
        { status: WaitlistStatus.REMOVED },
        tx,
      );
      const snapshot = await this.capacityRepo.findOneForUpdate(
        existing.courseId,
        existing.academicTerm,
        existing.sectionCode,
        tx,
      );
      if (snapshot && snapshot.waitlistCount > 0) {
        await this.capacityRepo.incrementWaitlist(snapshot.id, -1, tx);
      }
      return w;
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'waitlist.left',
      entity: 'Waitlist',
      entityId: id,
      ipAddress: ip,
      metadata: { courseId: existing.courseId },
    });

    this.events.publish(WAITLIST_EVENTS.LEFT, {
      waitlistId: id,
      studentId: existing.studentId,
      courseId: existing.courseId,
      academicTerm: existing.academicTerm,
    });

    return updated;
  }

  // ─── Promote (called by EnrollmentsService when a seat opens) ──────────

  /**
   * Inside the same transaction as the seat release, atomically:
   *   1. find the next eligible active waitlist entry (FOR UPDATE SKIP LOCKED)
   *   2. mark it as PROMOTED
   *   3. reserve a seat (seats_reserved++)
   *   4. set notifiedAt and expiresAt
   *
   * The actual creation of an enrollment row is deferred until the student
   * accepts the offer (or we auto-accept depending on policy). This method
   * returns the promoted Waitlist row for downstream notification.
   */
  async promoteNext(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    tx: Prisma.TransactionClient,
  ) {
    const next = await this.repo.nextToPromote(
      courseId,
      academicTerm,
      sectionCode,
      tx,
    );
    if (!next) return null;

    const expiresAt = new Date(
      Date.now() + this.reservationTtlHours * 60 * 60 * 1000,
    );
    const promoted = await this.repo.update(
      next.id,
      {
        status: WaitlistStatus.PROMOTED,
        notifiedAt: new Date(),
        expiresAt,
      },
      tx,
    );

    const snapshot = await this.capacityRepo.findOneForUpdate(
      courseId,
      academicTerm,
      sectionCode,
      tx,
    );
    if (snapshot) {
      await this.capacityRepo.incrementWaitlist(snapshot.id, -1, tx);
      await tx.courseCapacitySnapshot.update({
        where: { id: snapshot.id },
        data: { seatsReserved: { increment: 1 } },
      });
    }

    await tx.enrollmentAuditLog.create({
      data: {
        actorUserId: null,
        action: AuditAction.PROMOTED_WAITLIST,
        metadataJson: {
          waitlistId: promoted.id,
          courseId,
          academicTerm,
          sectionCode,
          studentId: promoted.studentId,
        },
      },
    });

    this.events.publish(WAITLIST_EVENTS.PROMOTED, {
      waitlistId: promoted.id,
      studentId: promoted.studentId,
      courseId: promoted.courseId,
      academicTerm: promoted.academicTerm,
      sectionCode: promoted.sectionCode,
      expiresAt: promoted.expiresAt,
    });

    return promoted;
  }
}
