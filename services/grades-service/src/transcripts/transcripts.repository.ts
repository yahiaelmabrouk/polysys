import { Injectable } from '@nestjs/common';
import { Prisma, Transcript, TranscriptStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TranscriptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TranscriptUncheckedCreateInput): Promise<Transcript> {
    return this.prisma.transcript.create({ data });
  }

  findById(id: string) {
    return this.prisma.transcript.findUnique({ where: { id } });
  }

  findByNumber(transcriptNumber: string) {
    return this.prisma.transcript.findUnique({ where: { transcriptNumber } });
  }

  findByStudent(studentId: string) {
    return this.prisma.transcript.findMany({
      where: { studentId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  findLatestCompletedByStudent(studentId: string) {
    return this.prisma.transcript.findFirst({
      where: { studentId, status: TranscriptStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.TranscriptUncheckedUpdateInput) {
    return this.prisma.transcript.update({ where: { id }, data });
  }

  async list(filters: {
    studentId?: string;
    status?: TranscriptStatus;
    requestType?: Prisma.TranscriptWhereInput['requestType'];
    page: number;
    limit: number;
  }): Promise<{ items: Transcript[]; total: number }> {
    const skip = (filters.page - 1) * filters.limit;
    const where: Prisma.TranscriptWhereInput = {};
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.status) where.status = filters.status;
    if (filters.requestType) where.requestType = filters.requestType;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transcript.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.transcript.count({ where }),
    ]);
    return { items, total };
  }
}
