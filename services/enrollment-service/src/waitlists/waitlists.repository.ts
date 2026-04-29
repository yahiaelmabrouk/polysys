import { Injectable } from '@nestjs/common';
import { Prisma, Waitlist, WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WaitlistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  findById(id: string) {
    return this.prisma.waitlist.findUnique({ where: { id } });
  }

  findActiveForStudent(
    studentId: string,
    courseId: string,
    academicTerm: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.client(tx).waitlist.findFirst({
      where: {
        studentId,
        courseId,
        academicTerm,
        status: WaitlistStatus.ACTIVE,
      },
    });
  }

  listForStudent(studentId: string, status?: WaitlistStatus) {
    return this.prisma.waitlist.findMany({
      where: { studentId, status },
      orderBy: { joinedAt: 'desc' },
    });
  }

  listForCourse(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null | undefined,
    page: number,
    limit: number,
  ) {
    const where: Prisma.WaitlistWhereInput = {
      courseId,
      academicTerm,
      ...(sectionCode !== undefined ? { sectionCode } : {}),
      status: WaitlistStatus.ACTIVE,
    };
    return this.prisma.$transaction([
      this.prisma.waitlist.findMany({
        where,
        orderBy: [
          { priorityScore: 'desc' },
          { position: 'asc' },
          { joinedAt: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.waitlist.count({ where }),
    ]);
  }

  /**
   * Returns the highest current waitlist position for the given course/term/section
   * (respecting NULL section semantics) using a SELECT ... FOR UPDATE so concurrent
   * joiners can't pick the same position.
   */
  async nextPosition(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const sectionPredicate = sectionCode === null
      ? Prisma.sql`section_code IS NULL`
      : Prisma.sql`section_code = ${sectionCode}`;
    const rows = await tx.$queryRaw<{ max: number | null }[]>`
      SELECT MAX(position) as max
      FROM waitlists
      WHERE course_id = ${courseId}
        AND academic_term = ${academicTerm}
        AND status = 'ACTIVE'
        AND ${sectionPredicate}
      FOR UPDATE
    `;
    const current = rows[0]?.max ?? 0;
    return current + 1;
  }

  create(
    data: Prisma.WaitlistUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Waitlist> {
    return this.client(tx).waitlist.create({ data });
  }

  update(
    id: string,
    data: Prisma.WaitlistUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Waitlist> {
    return this.client(tx).waitlist.update({ where: { id }, data });
  }

  /**
   * Returns the next active waitlist row to promote (highest priority,
   * then lowest position, then earliest join). Locks the row FOR UPDATE.
   */
  async nextToPromote(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<Waitlist | null> {
    const sectionPredicate = sectionCode === null
      ? Prisma.sql`section_code IS NULL`
      : Prisma.sql`section_code = ${sectionCode}`;
    const rows = await tx.$queryRaw<Waitlist[]>`
      SELECT *
      FROM waitlists
      WHERE course_id = ${courseId}
        AND academic_term = ${academicTerm}
        AND status = 'ACTIVE'
        AND ${sectionPredicate}
      ORDER BY priority_score DESC, position ASC, joined_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    return rows[0] ?? null;
  }
}
