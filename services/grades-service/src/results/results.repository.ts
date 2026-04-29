import { Injectable } from '@nestjs/common';
import { FinalCourseResult, Prisma, ResultStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface ResultListFilters {
  studentId?: string;
  courseId?: string;
  academicTerm?: string;
  resultStatus?: ResultStatus;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.finalCourseResult.findUnique({ where: { id } });
  }

  findByStudentCourseTerm(
    studentId: string,
    courseId: string,
    academicTerm: string,
  ) {
    return this.prisma.finalCourseResult.findUnique({
      where: {
        studentId_courseId_academicTerm: { studentId, courseId, academicTerm },
      },
    });
  }

  findByStudent(studentId: string, academicTerm?: string) {
    return this.prisma.finalCourseResult.findMany({
      where: { studentId, ...(academicTerm ? { academicTerm } : {}) },
      orderBy: [{ academicTerm: 'desc' }, { createdAt: 'asc' }],
    });
  }

  findCompletedByStudent(studentId: string) {
    return this.prisma.finalCourseResult.findMany({
      where: {
        studentId,
        publishedAt: { not: null },
        resultStatus: { in: [ResultStatus.PASS, ResultStatus.FAIL] },
      },
      orderBy: { academicTerm: 'asc' },
    });
  }

  findByCourseTerm(courseId: string, academicTerm: string) {
    return this.prisma.finalCourseResult.findMany({
      where: { courseId, academicTerm },
    });
  }

  findByTerm(academicTerm: string) {
    return this.prisma.finalCourseResult.findMany({ where: { academicTerm } });
  }

  upsert(data: Prisma.FinalCourseResultUncheckedCreateInput) {
    return this.prisma.finalCourseResult.upsert({
      where: {
        studentId_courseId_academicTerm: {
          studentId: data.studentId,
          courseId: data.courseId,
          academicTerm: data.academicTerm,
        },
      },
      create: data,
      update: {
        weightedScore: data.weightedScore,
        letterGrade: data.letterGrade,
        gradePoints: data.gradePoints,
        creditsEarned: data.creditsEarned,
        resultStatus: data.resultStatus,
        enrollmentId: data.enrollmentId,
      },
    });
  }

  publishCourseTerm(
    courseId: string,
    academicTerm: string,
    publishedAt: Date,
  ) {
    return this.prisma.finalCourseResult.updateMany({
      where: { courseId, academicTerm, publishedAt: null },
      data: { publishedAt },
    });
  }

  publishTerm(academicTerm: string, publishedAt: Date) {
    return this.prisma.finalCourseResult.updateMany({
      where: { academicTerm, publishedAt: null },
      data: { publishedAt },
    });
  }

  async list(filters: ResultListFilters): Promise<{
    items: FinalCourseResult[];
    total: number;
  }> {
    const skip = (filters.page - 1) * filters.limit;
    const where: Prisma.FinalCourseResultWhereInput = {};
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.academicTerm) where.academicTerm = filters.academicTerm;
    if (filters.resultStatus) where.resultStatus = filters.resultStatus;

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder: 'asc' | 'desc' = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.finalCourseResult.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: filters.limit,
      }),
      this.prisma.finalCourseResult.count({ where }),
    ]);
    return { items, total };
  }
}
