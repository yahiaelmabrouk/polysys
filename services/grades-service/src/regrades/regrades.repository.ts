import { Injectable } from '@nestjs/common';
import { Prisma, RegradeRequest, RegradeStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RegradesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.RegradeRequestUncheckedCreateInput) {
    return this.prisma.regradeRequest.create({ data });
  }

  findById(id: string) {
    return this.prisma.regradeRequest.findUnique({ where: { id } });
  }

  findOpenForGrade(gradeId: string) {
    return this.prisma.regradeRequest.findFirst({
      where: {
        gradeId,
        status: { in: [RegradeStatus.SUBMITTED, RegradeStatus.UNDER_REVIEW] },
      },
    });
  }

  update(id: string, data: Prisma.RegradeRequestUncheckedUpdateInput) {
    return this.prisma.regradeRequest.update({ where: { id }, data });
  }

  async list(filters: {
    studentId?: string;
    gradeId?: string;
    page: number;
    limit: number;
  }): Promise<{ items: RegradeRequest[]; total: number }> {
    const skip = (filters.page - 1) * filters.limit;
    const where: Prisma.RegradeRequestWhereInput = {};
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.gradeId) where.gradeId = filters.gradeId;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.regradeRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.regradeRequest.count({ where }),
    ]);
    return { items, total };
  }
}
