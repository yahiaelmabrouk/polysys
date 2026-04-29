import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

/**
 * CapacityRepository
 *
 * All mutating methods accept an optional Prisma transaction client (`tx`)
 * so seat counters can be updated atomically with enrollment writes.
 */
@Injectable()
export class CapacityRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  findOne(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    return this.client(tx).courseCapacitySnapshot.findFirst({
      where: { courseId, academicTerm, sectionCode },
    });
  }

  findByCourseTerm(courseId: string, academicTerm: string) {
    return this.prisma.courseCapacitySnapshot.findMany({
      where: { courseId, academicTerm },
      orderBy: { sectionCode: 'asc' },
    });
  }

  /**
   * Locks the matching row FOR UPDATE so concurrent transactions block until
   * this one commits. Returns null when no snapshot exists.
   */
  async findOneForUpdate(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<{
    id: string;
    capacityTotal: number;
    seatsTaken: number;
    seatsReserved: number;
    waitlistCount: number;
  } | null> {
    const sectionPredicate = sectionCode === null
      ? Prisma.sql`section_code IS NULL`
      : Prisma.sql`section_code = ${sectionCode}`;

    const rows = await tx.$queryRaw<
      {
        id: string;
        capacity_total: number;
        seats_taken: number;
        seats_reserved: number;
        waitlist_count: number;
      }[]
    >`
      SELECT id, capacity_total, seats_taken, seats_reserved, waitlist_count
      FROM course_capacity_snapshots
      WHERE course_id = ${courseId}
        AND academic_term = ${academicTerm}
        AND ${sectionPredicate}
      FOR UPDATE
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      capacityTotal: r.capacity_total,
      seatsTaken: r.seats_taken,
      seatsReserved: r.seats_reserved,
      waitlistCount: r.waitlist_count,
    };
  }

  upsert(
    data: {
      courseId: string;
      academicTerm: string;
      sectionCode: string | null;
      capacityTotal: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.ensureSnapshot(
      data.courseId,
      data.academicTerm,
      data.sectionCode,
      data.capacityTotal,
      tx,
    );
  }

  /**
   * Ensure a snapshot row exists for (course, term, section). If missing,
   * create one with the supplied default capacity. Safe under concurrency
   * thanks to the unique index `course_capacity_snapshots_unique`.
   */
  async ensureSnapshot(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    defaultCapacity: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.client(tx);
    const existing = await client.courseCapacitySnapshot.findFirst({
      where: { courseId, academicTerm, sectionCode },
    });
    if (existing) return existing;

    try {
      return await client.courseCapacitySnapshot.create({
        data: {
          courseId,
          academicTerm,
          sectionCode,
          capacityTotal: defaultCapacity,
        },
      });
    } catch (err) {
      // Race: another tx created it; refetch.
      const after = await client.courseCapacitySnapshot.findFirst({
        where: { courseId, academicTerm, sectionCode },
      });
      if (after) return after;
      throw err;
    }
  }

  incrementSeats(
    id: string,
    delta: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.client(tx).courseCapacitySnapshot.update({
      where: { id },
      data: { seatsTaken: { increment: delta } },
    });
  }

  incrementWaitlist(
    id: string,
    delta: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.client(tx).courseCapacitySnapshot.update({
      where: { id },
      data: { waitlistCount: { increment: delta } },
    });
  }

  setCapacity(
    id: string,
    capacityTotal: number,
    tx?: Prisma.TransactionClient,
  ) {
    return this.client(tx).courseCapacitySnapshot.update({
      where: { id },
      data: { capacityTotal },
    });
  }
}
