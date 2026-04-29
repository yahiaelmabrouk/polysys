import { Injectable } from '@nestjs/common';
import { Prisma, Attendance, AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Attendance | null> {
    return this.prisma.attendance.findUnique({ where: { id } });
  }

  findExisting(studentId: string, courseId: string, sessionDate: Date) {
    return this.prisma.attendance.findUnique({
      where: { studentId_courseId_sessionDate: { studentId, courseId, sessionDate } },
    });
  }

  create(data: Prisma.AttendanceUncheckedCreateInput): Promise<Attendance> {
    return this.prisma.attendance.create({ data });
  }

  upsert(
    studentId: string,
    courseId: string,
    sessionDate: Date,
    status: AttendanceStatus,
    markedByUserId: string,
    notes?: string,
  ): Promise<Attendance> {
    return this.prisma.attendance.upsert({
      where: { studentId_courseId_sessionDate: { studentId, courseId, sessionDate } },
      update: { status, notes, markedByUserId },
      create: { studentId, courseId, sessionDate, status, markedByUserId, notes },
    });
  }

  update(id: string, data: Prisma.AttendanceUpdateInput): Promise<Attendance> {
    return this.prisma.attendance.update({ where: { id }, data });
  }

  async findForStudent(studentId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where: { studentId },
        orderBy: { sessionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendance.count({ where: { studentId } }),
    ]);
    return { items, total };
  }

  async findForCourse(courseId: string, sessionDate?: Date, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: Prisma.AttendanceWhereInput = { courseId };
    if (sessionDate) where.sessionDate = sessionDate;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ sessionDate: 'desc' }, { studentId: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return { items, total };
  }

  async attendanceRate(studentId: string, courseId?: string): Promise<number> {
    const where: Prisma.AttendanceWhereInput = { studentId };
    if (courseId) where.courseId = courseId;
    const [total, present] = await this.prisma.$transaction([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.count({
        where: { ...where, status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED] } },
      }),
    ]);
    if (total === 0) return 100;
    return Math.round((present / total) * 100);
  }
}
