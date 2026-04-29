import { Injectable } from '@nestjs/common';
import { GpaSnapshot, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class GpaRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsert(data: Prisma.GpaSnapshotUncheckedCreateInput): Promise<GpaSnapshot> {
    return this.prisma.gpaSnapshot.upsert({
      where: {
        studentId_academicTerm: {
          studentId: data.studentId,
          academicTerm: data.academicTerm,
        },
      },
      create: data,
      update: {
        termGpa: data.termGpa,
        cumulativeGpa: data.cumulativeGpa,
        creditsAttempted: data.creditsAttempted,
        creditsEarned: data.creditsEarned,
        academicStanding: data.academicStanding,
        calculatedAt: new Date(),
      },
    });
  }

  findByStudent(studentId: string) {
    return this.prisma.gpaSnapshot.findMany({
      where: { studentId },
      orderBy: { academicTerm: 'asc' },
    });
  }

  findLatestByStudent(studentId: string) {
    return this.prisma.gpaSnapshot.findFirst({
      where: { studentId },
      orderBy: { calculatedAt: 'desc' },
    });
  }

  findByStudentTerm(studentId: string, academicTerm: string) {
    return this.prisma.gpaSnapshot.findUnique({
      where: { studentId_academicTerm: { studentId, academicTerm } },
    });
  }
}
