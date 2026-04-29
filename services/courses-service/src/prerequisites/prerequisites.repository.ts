import { Injectable } from '@nestjs/common';
import { Prisma, CoursePrerequisite, PrerequisiteType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PrerequisitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<CoursePrerequisite | null> {
    return this.prisma.coursePrerequisite.findUnique({ where: { id } });
  }

  findExisting(courseId: string, prerequisiteCourseId: string, type: PrerequisiteType) {
    return this.prisma.coursePrerequisite.findUnique({
      where: {
        courseId_prerequisiteCourseId_type: { courseId, prerequisiteCourseId, type },
      },
    });
  }

  create(data: Prisma.CoursePrerequisiteUncheckedCreateInput) {
    return this.prisma.coursePrerequisite.create({ data });
  }

  delete(id: string) {
    return this.prisma.coursePrerequisite.delete({ where: { id } });
  }

  listForCourse(courseId: string) {
    return this.prisma.coursePrerequisite.findMany({
      where: { courseId },
      include: {
        prerequisiteCourse: {
          select: { id: true, courseCode: true, title: true, status: true },
        },
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // Returns IDs of direct prerequisites of a course (REQUIRED + COREQUISITE)
  async getDirectPrereqIds(courseId: string): Promise<string[]> {
    const rows = await this.prisma.coursePrerequisite.findMany({
      where: { courseId },
      select: { prerequisiteCourseId: true },
    });
    return rows.map((r) => r.prerequisiteCourseId);
  }
}
