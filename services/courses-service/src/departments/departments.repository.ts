import { Injectable } from '@nestjs/common';
import { Prisma, Department } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DepartmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Department | null> {
    return this.prisma.department.findUnique({ where: { id } });
  }

  findByCode(code: string): Promise<Department | null> {
    return this.prisma.department.findUnique({ where: { code } });
  }

  create(data: Prisma.DepartmentCreateInput): Promise<Department> {
    return this.prisma.department.create({ data });
  }

  update(id: string, data: Prisma.DepartmentUpdateInput): Promise<Department> {
    return this.prisma.department.update({ where: { id }, data });
  }

  async list(opts: {
    keyword?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  }) {
    const skip = (opts.page - 1) * opts.limit;
    const where: Prisma.DepartmentWhereInput = {};
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    if (opts.keyword) {
      where.OR = [
        { code: { contains: opts.keyword, mode: 'insensitive' } },
        { name: { contains: opts.keyword, mode: 'insensitive' } },
        { facultyName: { contains: opts.keyword, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: opts.limit,
      }),
      this.prisma.department.count({ where }),
    ]);
    return { items, total };
  }
}
