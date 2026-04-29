import { Injectable } from '@nestjs/common';
import { Enrollment, EnrollmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const ACTIVE_STATUSES: EnrollmentStatus[] = [
  EnrollmentStatus.PENDING,
  EnrollmentStatus.ENROLLED,
  EnrollmentStatus.WAITLISTED,
];

@Injectable()
export class EnrollmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  findById(id: string, includeAuditLogs = false) {
    return this.prisma.enrollment.findUnique({
      where: { id },
      include: includeAuditLogs ? { auditLogs: true } : undefined,
    });
  }

  findActiveForStudent(
    studentId: string,
    courseId: string,
    academicTerm: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.client(tx).enrollment.findFirst({
      where: {
        studentId,
        courseId,
        academicTerm,
        status: { in: ACTIVE_STATUSES },
      },
    });
  }

  /**
   * Sum of credits in active (ENROLLED / PENDING) enrollments for a student
   * in a given term. Used for credit-load enforcement.
   */
  async currentLoad(
    studentId: string,
    academicTerm: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.client(tx).enrollment.aggregate({
      where: {
        studentId,
        academicTerm,
        status: { in: [EnrollmentStatus.ENROLLED, EnrollmentStatus.PENDING] },
      },
      _sum: { creditsSnapshot: true },
    });
    return Number(result._sum.creditsSnapshot ?? 0);
  }

  listForStudent(studentId: string, academicTerm?: string) {
    return this.prisma.enrollment.findMany({
      where: { studentId, academicTerm },
      orderBy: [{ academicTerm: 'desc' }, { enrolledAt: 'desc' }],
    });
  }

  /**
   * Course roster: students currently ENROLLED in a course/term/(section).
   */
  rosterFor(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null | undefined,
  ): Promise<Enrollment[]> {
    return this.prisma.enrollment.findMany({
      where: {
        courseId,
        academicTerm,
        ...(sectionCode !== undefined ? { sectionCode } : {}),
        status: EnrollmentStatus.ENROLLED,
      },
      orderBy: { enrolledAt: 'asc' },
    });
  }

  list(filters: {
    studentId?: string;
    courseId?: string;
    academicTerm?: string;
    sectionCode?: string;
    status?: EnrollmentStatus;
    source?: string;
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeAuditLogs?: boolean;
  }) {
    const where: Prisma.EnrollmentWhereInput = {
      studentId: filters.studentId,
      courseId: filters.courseId,
      academicTerm: filters.academicTerm,
      sectionCode: filters.sectionCode,
      status: filters.status,
      source: filters.source as Prisma.EnumEnrollmentSourceFilter | undefined,
    };

    const orderBy: Prisma.EnrollmentOrderByWithRelationInput = filters.sortBy
      ? { [filters.sortBy]: filters.sortOrder ?? 'desc' }
      : { enrolledAt: 'desc' };

    return this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: filters.includeAuditLogs ? { auditLogs: true } : undefined,
      }),
      this.prisma.enrollment.count({ where }),
    ]);
  }

  create(
    data: Prisma.EnrollmentUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Enrollment> {
    return this.client(tx).enrollment.create({ data });
  }

  update(
    id: string,
    data: Prisma.EnrollmentUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Enrollment> {
    return this.client(tx).enrollment.update({ where: { id }, data });
  }
}
