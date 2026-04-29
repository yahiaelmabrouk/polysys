import { Injectable } from '@nestjs/common';
import { Prisma, Student, EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StudentSearchDto } from './dto/student.dto';

@Injectable()
export class StudentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.StudentCreateInput): Promise<Student> {
    return this.prisma.student.create({ data });
  }

  findById(id: string) {
    return this.prisma.student.findUnique({
      where: { id },
      include: { profile: true, contacts: true },
    });
  }

  findByAuthUserId(authUserId: string) {
    return this.prisma.student.findUnique({
      where: { authUserId },
      include: { profile: true, contacts: true },
    });
  }

  findByStudentNumber(studentNumber: string) {
    return this.prisma.student.findUnique({
      where: { studentNumber },
      include: { profile: true, contacts: true },
    });
  }

  update(id: string, data: Prisma.StudentUpdateInput): Promise<Student> {
    return this.prisma.student.update({ where: { id }, data });
  }

  updateStatus(id: string, status: EnrollmentStatus): Promise<Student> {
    return this.prisma.student.update({ where: { id }, data: { enrollmentStatus: status } });
  }

  countByPrefix(prefix: string): Promise<number> {
    return this.prisma.student.count({
      where: { studentNumber: { startsWith: prefix } },
    });
  }

  async search(filters: StudentSearchDto): Promise<{ items: Student[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {};

    if (filters.name) {
      where.OR = [
        { firstName: { contains: filters.name, mode: 'insensitive' } },
        { lastName: { contains: filters.name, mode: 'insensitive' } },
      ];
    }
    if (filters.studentNumber) where.studentNumber = { contains: filters.studentNumber, mode: 'insensitive' };
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.program) where.programName = { contains: filters.program, mode: 'insensitive' };
    if (filters.level !== undefined) where.currentLevel = filters.level;
    if (filters.status) where.enrollmentStatus = filters.status;
    if (filters.advisorId) where.advisorId = filters.advisorId;
    if (filters.admissionYear) {
      const start = new Date(`${filters.admissionYear}-01-01`);
      const end = new Date(`${filters.admissionYear + 1}-01-01`);
      where.admissionDate = { gte: start, lt: end };
    }

    const sortBy = filters.sortBy ?? 'createdAt';
    const sortOrder = filters.sortOrder ?? 'desc';
    const orderBy: Prisma.StudentOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    } as Prisma.StudentOrderByWithRelationInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({ where, orderBy, skip, take: limit, include: { profile: true } }),
      this.prisma.student.count({ where }),
    ]);

    return { items, total };
  }

  exists(id: string): Promise<boolean> {
    return this.prisma.student.count({ where: { id } }).then((c) => c > 0);
  }
}
