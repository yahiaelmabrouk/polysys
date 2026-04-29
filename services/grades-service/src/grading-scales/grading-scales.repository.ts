import { Injectable } from '@nestjs/common';
import { GradingScale, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GradingScalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<GradingScale | null> {
    return this.prisma.gradingScale.findUnique({ where: { id } });
  }

  findActive(name = 'default'): Promise<GradingScale[]> {
    return this.prisma.gradingScale.findMany({
      where: { name, isActive: true },
      orderBy: { minPercentage: 'desc' },
    });
  }

  list(name?: string): Promise<GradingScale[]> {
    return this.prisma.gradingScale.findMany({
      where: name ? { name } : undefined,
      orderBy: [{ name: 'asc' }, { minPercentage: 'desc' }],
    });
  }

  create(data: Prisma.GradingScaleUncheckedCreateInput): Promise<GradingScale> {
    return this.prisma.gradingScale.create({ data });
  }

  update(
    id: string,
    data: Prisma.GradingScaleUncheckedUpdateInput,
  ): Promise<GradingScale> {
    return this.prisma.gradingScale.update({ where: { id }, data });
  }

  delete(id: string): Promise<GradingScale> {
    return this.prisma.gradingScale.delete({ where: { id } });
  }
}
