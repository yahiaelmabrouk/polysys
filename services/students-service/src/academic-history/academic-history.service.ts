import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RecordAcademicHistoryDto } from './dto/academic-history.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { ACADEMIC_EVENTS } from '../events/event-names';

@Injectable()
export class AcademicHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  findForStudent(studentId: string) {
    return this.prisma.academicHistory.findMany({
      where: { studentId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  findOne(studentId: string, semesterName: string) {
    return this.prisma.academicHistory.findUnique({
      where: { studentId_semesterName: { studentId, semesterName } },
    });
  }

  /**
   * Records (or upserts) a semester snapshot from Grades Service.
   * This is idempotent on (studentId, semesterName).
   */
  async record(
    studentId: string,
    dto: RecordAcademicHistoryDto,
    actorUserId?: string,
  ) {
    const record = await this.prisma.academicHistory.upsert({
      where: { studentId_semesterName: { studentId, semesterName: dto.semesterName } },
      update: {
        creditsAttempted: dto.creditsAttempted,
        creditsCompleted: dto.creditsCompleted,
        gpa: dto.gpa,
        cgpa: dto.cgpa,
        academicStanding: dto.academicStanding,
        remarks: dto.remarks,
      },
      create: {
        studentId,
        semesterName: dto.semesterName,
        creditsAttempted: dto.creditsAttempted,
        creditsCompleted: dto.creditsCompleted,
        gpa: dto.gpa,
        cgpa: dto.cgpa,
        academicStanding: dto.academicStanding,
        remarks: dto.remarks,
      },
    });

    await this.auditLog.log({
      userId: actorUserId,
      action: 'academic_history.recorded',
      entity: 'AcademicHistory',
      entityId: record.id,
      metadata: { semester: dto.semesterName, gpa: dto.gpa, standing: dto.academicStanding },
    });

    this.events.publish(ACADEMIC_EVENTS.HISTORY_UPDATED, {
      studentId,
      semesterName: dto.semesterName,
      gpa: dto.gpa,
      cgpa: dto.cgpa,
      academicStanding: dto.academicStanding,
    });

    return record;
  }
}
