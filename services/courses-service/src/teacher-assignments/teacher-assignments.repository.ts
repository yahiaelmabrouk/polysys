import { Injectable } from '@nestjs/common';
import { Prisma, TeacherAssignment, AssignmentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TeacherAssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<TeacherAssignment | null> {
    return this.prisma.teacherAssignment.findUnique({ where: { id } });
  }

  findExisting(courseId: string, academicTerm: string, sectionCode: string) {
    return this.prisma.teacherAssignment.findUnique({
      where: { courseId_academicTerm_sectionCode: { courseId, academicTerm, sectionCode } },
    });
  }

  create(data: Prisma.TeacherAssignmentUncheckedCreateInput) {
    return this.prisma.teacherAssignment.create({ data });
  }

  update(id: string, data: Prisma.TeacherAssignmentUncheckedUpdateInput) {
    return this.prisma.teacherAssignment.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.teacherAssignment.update({
      where: { id },
      data: { status: AssignmentStatus.REMOVED },
    });
  }

  listByTeacher(teacherUserId: string) {
    return this.prisma.teacherAssignment.findMany({
      where: { teacherUserId, status: AssignmentStatus.ACTIVE },
      include: {
        course: {
          select: { id: true, courseCode: true, title: true, status: true },
        },
      },
      orderBy: [{ academicTerm: 'desc' }, { sectionCode: 'asc' }],
    });
  }

  listByCourse(courseId: string) {
    return this.prisma.teacherAssignment.findMany({
      where: { courseId },
      orderBy: [{ academicTerm: 'desc' }, { sectionCode: 'asc' }],
    });
  }
}
