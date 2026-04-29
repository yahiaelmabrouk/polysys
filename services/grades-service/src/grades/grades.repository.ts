import { Injectable } from '@nestjs/common';
import { Grade, GradeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface GradeListFilters {
  studentId?: string;
  courseId?: string;
  academicTerm?: string;
  teacherId?: string;
  assessmentId?: string;
  assessmentType?: Grade['letterGrade'] extends never ? never : string;
  status?: GradeStatus;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const ALLOWED_SORT = new Set([
  'createdAt',
  'updatedAt',
  'gradedAt',
  'rawScore',
  'percentageScore',
  'status',
]);

@Injectable()
export class GradesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.grade.findUnique({
      where: { id },
      include: { assessment: true },
    });
  }

  findByAssessmentAndStudent(assessmentId: string, studentId: string) {
    return this.prisma.grade.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId } },
    });
  }

  findManyByAssessment(assessmentId: string) {
    return this.prisma.grade.findMany({ where: { assessmentId } });
  }

  /**
   * Returns published grades for a single student in a (course, term) bucket,
   * joined to the assessment row so callers can read maxScore + weight.
   */
  findPublishedByStudentCourseTerm(
    studentId: string,
    courseId: string,
    academicTerm: string,
  ) {
    return this.prisma.grade.findMany({
      where: {
        studentId,
        status: GradeStatus.PUBLISHED,
        assessment: { courseId, academicTerm },
      },
      include: { assessment: true },
    });
  }

  findManyByStudent(studentId: string, academicTerm?: string) {
    return this.prisma.grade.findMany({
      where: {
        studentId,
        ...(academicTerm
          ? { assessment: { academicTerm } }
          : {}),
        status: { not: GradeStatus.DRAFT },
      },
      include: { assessment: true },
      orderBy: { gradedAt: 'desc' },
    });
  }

  upsert(input: Prisma.GradeUncheckedCreateInput): Promise<Grade> {
    return this.prisma.grade.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId: input.assessmentId,
          studentId: input.studentId,
        },
      },
      create: input,
      update: {
        rawScore: input.rawScore,
        percentageScore: input.percentageScore,
        letterGrade: input.letterGrade,
        remarks: input.remarks,
        gradedByUserId: input.gradedByUserId,
        gradedAt: new Date(),
        status: input.status,
        enrollmentId: input.enrollmentId,
      },
    });
  }

  update(id: string, data: Prisma.GradeUncheckedUpdateInput): Promise<Grade> {
    return this.prisma.grade.update({ where: { id }, data });
  }

  publishMany(ids: string[]) {
    return this.prisma.grade.updateMany({
      where: { id: { in: ids }, status: GradeStatus.DRAFT },
      data: { status: GradeStatus.PUBLISHED },
    });
  }

  publishForCourseTerm(courseId: string, academicTerm: string) {
    return this.prisma.grade.updateMany({
      where: {
        status: GradeStatus.DRAFT,
        assessment: { courseId, academicTerm },
      },
      data: { status: GradeStatus.PUBLISHED },
    });
  }

  async list(filters: GradeListFilters) {
    const skip = (filters.page - 1) * filters.limit;
    const where: Prisma.GradeWhereInput = {};

    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.assessmentId) where.assessmentId = filters.assessmentId;
    if (filters.status) where.status = filters.status;

    const assessmentWhere: Prisma.AssessmentWhereInput = {};
    if (filters.courseId) assessmentWhere.courseId = filters.courseId;
    if (filters.academicTerm) assessmentWhere.academicTerm = filters.academicTerm;
    if (filters.assessmentType)
      assessmentWhere.type = filters.assessmentType as Prisma.AssessmentWhereInput['type'];
    if (Object.keys(assessmentWhere).length) where.assessment = assessmentWhere;

    if (filters.teacherId) where.gradedByUserId = filters.teacherId;

    const sortBy =
      filters.sortBy && ALLOWED_SORT.has(filters.sortBy)
        ? filters.sortBy
        : 'gradedAt';
    const sortOrder: 'asc' | 'desc' = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.grade.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: filters.limit,
        include: { assessment: true },
      }),
      this.prisma.grade.count({ where }),
    ]);
    return { items, total };
  }
}
