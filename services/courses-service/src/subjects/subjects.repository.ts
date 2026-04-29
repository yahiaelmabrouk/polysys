import { Injectable } from '@nestjs/common';
import { Prisma, Subject } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Subject | null> {
    return this.prisma.subject.findUnique({ where: { id } });
  }

  findByCode(code: string): Promise<Subject | null> {
    return this.prisma.subject.findUnique({ where: { code } });
  }

  create(data: Prisma.SubjectUncheckedCreateInput): Promise<Subject> {
    return this.prisma.subject.create({ data });
  }

  update(id: string, data: Prisma.SubjectUncheckedUpdateInput): Promise<Subject> {
    return this.prisma.subject.update({ where: { id }, data });
  }

  async list(opts: {
    keyword?: string;
    departmentId?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  }) {
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.SubjectWhereInput = {};
    if (opts.departmentId) where.departmentId = opts.departmentId;
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    if (opts.keyword) {
      where.OR = [
        { code: { contains: opts.keyword, mode: 'insensitive' } },
        { name: { contains: opts.keyword, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: opts.limit,
        include: { department: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.subject.count({ where }),
    ]);
    return { items, total };
  }
}
