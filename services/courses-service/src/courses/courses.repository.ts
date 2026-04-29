import { Injectable } from '@nestjs/common';
import { Prisma, Course, CourseStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface CourseListFilters {
  keyword?: string;
  departmentId?: string;
  subjectId?: string;
  credits?: number;
  level?: Course['level'];
  semesterType?: Course['semesterType'];
  deliveryMode?: Course['deliveryMode'];
  status?: CourseStatus;
  teacherId?: string;
  includePrerequisites?: boolean;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

const ALLOWED_SORT = new Set([
  'createdAt',
  'updatedAt',
  'courseCode',
  'title',
  'credits',
  'level',
  'status',
]);

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, includePrerequisites = false) {
    return this.prisma.course.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        tags: true,
        prerequisites: includePrerequisites
          ? {
              include: {
                prerequisiteCourse: {
                  select: { id: true, courseCode: true, title: true },
                },
              },
            }
          : false,
      },
    });
  }

  findByCode(courseCode: string, includePrerequisites = false) {
    return this.prisma.course.findUnique({
      where: { courseCode },
      include: {
        subject: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        tags: true,
        prerequisites: includePrerequisites
          ? {
              include: {
                prerequisiteCourse: {
                  select: { id: true, courseCode: true, title: true },
                },
              },
            }
          : false,
      },
    });
  }

  create(data: Prisma.CourseUncheckedCreateInput): Promise<Course> {
    return this.prisma.course.create({ data });
  }

  update(id: string, data: Prisma.CourseUncheckedUpdateInput): Promise<Course> {
    return this.prisma.course.update({ where: { id }, data });
  }

  delete(id: string): Promise<Course> {
    return this.prisma.course.delete({ where: { id } });
  }

  async list(filters: CourseListFilters) {
    const skip = (filters.page - 1) * filters.limit;
    const where: Prisma.CourseWhereInput = {};

    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.credits !== undefined) where.credits = filters.credits;
    if (filters.level) where.level = filters.level;
    if (filters.semesterType) where.semesterType = filters.semesterType;
    if (filters.deliveryMode) where.deliveryMode = filters.deliveryMode;
    if (filters.status) where.status = filters.status;
    if (filters.teacherId) {
      where.teacherAssignments = {
        some: { teacherUserId: filters.teacherId, status: 'ACTIVE' },
      };
    }
    if (filters.keyword) {
      where.OR = [
        { courseCode: { contains: filters.keyword, mode: 'insensitive' } },
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { description: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    const sortBy = filters.sortBy && ALLOWED_SORT.has(filters.sortBy) ? filters.sortBy : 'createdAt';
    const sortOrder: 'asc' | 'desc' = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: filters.limit,
        include: {
          subject: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
          tags: true,
          prerequisites: filters.includePrerequisites
            ? {
                include: {
                  prerequisiteCourse: {
                    select: { id: true, courseCode: true, title: true },
                  },
                },
              }
            : false,
        },
      }),
      this.prisma.course.count({ where }),
    ]);
    return { items, total };
  }

  // Tags helpers
  replaceTags(courseId: string, tagNames: string[]) {
    return this.prisma.$transaction([
      this.prisma.courseTag.deleteMany({ where: { courseId } }),
      ...(tagNames.length
        ? [
            this.prisma.courseTag.createMany({
              data: tagNames.map((tagName) => ({ courseId, tagName })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  }

  // Used for the teachers/me/courses route
  findByTeacher(teacherUserId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return this.prisma.$transaction([
      this.prisma.course.findMany({
        where: {
          teacherAssignments: { some: { teacherUserId, status: 'ACTIVE' } },
        },
        orderBy: { courseCode: 'asc' },
        skip,
        take: limit,
        include: {
          teacherAssignments: {
            where: { teacherUserId, status: 'ACTIVE' },
            select: {
              id: true,
              academicTerm: true,
              sectionCode: true,
              maxStudents: true,
            },
          },
        },
      }),
      this.prisma.course.count({
        where: { teacherAssignments: { some: { teacherUserId, status: 'ACTIVE' } } },
      }),
    ]);
  }

  // Eligibility rules used by Enrollment Service via /internal
  getEligibilityRules(id: string) {
    return this.prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        courseCode: true,
        credits: true,
        capacityDefault: true,
        status: true,
        prerequisites: {
          select: {
            type: true,
            minimumGrade: true,
            prerequisiteCourse: {
              select: { id: true, courseCode: true, title: true },
            },
          },
        },
      },
    });
  }
}
