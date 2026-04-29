import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CapacityRepository } from './capacity.repository';
import { UpsertCapacityDto } from './dto/capacity.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { COURSE_CAPACITY_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { CoursesClient } from '../clients/courses.client';

export interface SeatStatus {
  courseId: string;
  academicTerm: string;
  sectionCode: string | null;
  capacityTotal: number;
  seatsTaken: number;
  seatsReserved: number;
  seatsAvailable: number;
  waitlistCount: number;
  isFull: boolean;
}

@Injectable()
export class CapacityService {
  private readonly logger = new Logger(CapacityService.name);

  constructor(
    private readonly repo: CapacityRepository,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
    private readonly coursesClient: CoursesClient,
  ) {}

  /**
   * Used by the enrollment flow inside a transaction. Locks the snapshot row
   * with FOR UPDATE so two concurrent enrollment requests cannot both pass
   * the seat-availability check and oversubscribe a section.
   */
  async lockAndGet(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    tx: Prisma.TransactionClient,
  ) {
    const row = await this.repo.findOneForUpdate(
      courseId,
      academicTerm,
      sectionCode,
      tx,
    );
    return row;
  }

  async getSeatStatus(
    courseId: string,
    academicTerm: string,
  ): Promise<SeatStatus[]> {
    const rows = await this.repo.findByCourseTerm(courseId, academicTerm);
    if (rows.length === 0) {
      return [
        {
          courseId,
          academicTerm,
          sectionCode: null,
          capacityTotal: 0,
          seatsTaken: 0,
          seatsReserved: 0,
          seatsAvailable: 0,
          waitlistCount: 0,
          isFull: true,
        },
      ];
    }
    return rows.map((r) => ({
      courseId: r.courseId,
      academicTerm: r.academicTerm,
      sectionCode: r.sectionCode,
      capacityTotal: r.capacityTotal,
      seatsTaken: r.seatsTaken,
      seatsReserved: r.seatsReserved,
      seatsAvailable: Math.max(
        0,
        r.capacityTotal - r.seatsTaken - r.seatsReserved,
      ),
      waitlistCount: r.waitlistCount,
      isFull: r.seatsTaken + r.seatsReserved >= r.capacityTotal,
    }));
  }

  /**
   * Make sure a snapshot exists for (course, term, section). If we have to
   * create one, the default capacity comes from Courses Service metadata.
   */
  async ensureSnapshot(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    const existing = await this.repo.findOne(
      courseId,
      academicTerm,
      sectionCode,
      tx,
    );
    if (existing) return existing;

    const course = await this.coursesClient.findById(courseId);
    const defaultCapacity = course?.capacityDefault ?? 0;
    return this.repo.ensureSnapshot(
      courseId,
      academicTerm,
      sectionCode,
      defaultCapacity,
      tx,
    );
  }

  async upsertCapacity(
    courseId: string,
    dto: UpsertCapacityDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    if (dto.capacityTotal < 0) {
      throw new BadRequestException('capacityTotal must be >= 0');
    }
    const sectionCode = dto.sectionCode ?? null;
    const existing = await this.repo.findOne(
      courseId,
      dto.academicTerm,
      sectionCode,
    );

    let snapshot;
    if (existing) {
      if (dto.capacityTotal < existing.seatsTaken) {
        throw new BadRequestException(
          `capacityTotal (${dto.capacityTotal}) cannot be lower than current seats_taken (${existing.seatsTaken})`,
        );
      }
      snapshot = await this.repo.setCapacity(existing.id, dto.capacityTotal);
    } else {
      snapshot = await this.repo.ensureSnapshot(
        courseId,
        dto.academicTerm,
        sectionCode,
        dto.capacityTotal,
      );
    }

    await this.auditLog.log({
      userId: actor.sub,
      action: 'capacity.changed',
      entity: 'CourseCapacitySnapshot',
      entityId: snapshot.id,
      ipAddress: ip,
      metadata: {
        courseId,
        academicTerm: dto.academicTerm,
        sectionCode,
        capacityTotal: dto.capacityTotal,
      },
    });

    this.events.publish(COURSE_CAPACITY_EVENTS.CHANGED, {
      courseId,
      academicTerm: dto.academicTerm,
      sectionCode,
      capacityTotal: dto.capacityTotal,
    });

    return snapshot;
  }

  async findOneOrFail(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
  ) {
    const row = await this.repo.findOne(courseId, academicTerm, sectionCode);
    if (!row) {
      throw new NotFoundException('Capacity snapshot not found');
    }
    return row;
  }
}
