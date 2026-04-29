import { Injectable } from '@nestjs/common';
import { Assessment, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AssessmentListFilters {
  courseId?: string;
  academicTerm?: string;
  sectionCode?: string;
  type?: Assessment['type'];
  status?: Assessment['status'];
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const ALLOWED_SORT = new Set([
  'createdAt',
  'updatedAt',
  'title',
  'type',
  'status',
  'dueDate',
  'examDate',
  'weightPercentage',
]);

@Injectable()
export class AssessmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.assessment.findUnique({ where: { id } });
  }

  findByCourseTerm(courseId: string, academicTerm: string, sectionCode?: string) {
    return this.prisma.assessment.findMany({
      where: {
        courseId,
        academicTerm,
        ...(sectionCode !== undefined ? { sectionCode } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Sums weight_percentage of non-archived assessments for the same
   * course/term/section. Used to enforce <= 100% rule.
   * Returns a number for ergonomic comparisons.
   */
  async sumActiveWeights(
    courseId: string,
    academicTerm: string,
    sectionCode: string | null,
    excludeAssessmentId?: string,
  ): Promise<number> {
    const where: Prisma.AssessmentWhereInput = {
      courseId,
      academicTerm,
      sectionCode,
      status: { not: 'ARCHIVED' },
      ...(excludeAssessmentId ? { NOT: { id: excludeAssessmentId } } : {}),
    };
    const result = await this.prisma.assessment.aggregate({
      _sum: { weightPercentage: true },
      where,
    });
    return Number(result._sum.weightPercentage ?? 0);
  }

  create(data: Prisma.AssessmentUncheckedCreateInput): Promise<Assessment> {
    return this.prisma.assessment.create({ data });
  }

  update(
    id: string,
    data: Prisma.AssessmentUncheckedUpdateInput,
  ): Promise<Assessment> {
    return this.prisma.assessment.update({ where: { id }, data });
  }

  delete(id: string): Promise<Assessment> {
    return this.prisma.assessment.delete({ where: { id } });
  }

  async list(filters: AssessmentListFilters) {
    const skip = (filters.page - 1) * filters.limit;
    const where: Prisma.AssessmentWhereInput = {};
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.academicTerm) where.academicTerm = filters.academicTerm;
    if (filters.sectionCode) where.sectionCode = filters.sectionCode;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const sortBy =
      filters.sortBy && ALLOWED_SORT.has(filters.sortBy)
        ? filters.sortBy
        : 'createdAt';
    const sortOrder: 'asc' | 'desc' = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.assessment.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: filters.limit,
      }),
      this.prisma.assessment.count({ where }),
    ]);
    return { items, total };
  }
}
