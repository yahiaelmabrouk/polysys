import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttendanceStatus } from '@prisma/client';
import { AttendanceRepository } from './attendance.repository';
import {
  CreateAttendanceDto,
  BulkAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { ATTENDANCE_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { buildPaginated, PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly repo: AttendanceRepository,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  // ─── Mark single ────────────────────────────────────────────────────────

  async mark(dto: CreateAttendanceDto, actor: JwtPayload, ip?: string) {
    const sessionDate = new Date(dto.sessionDate);
    const existing = await this.repo.findExisting(dto.studentId, dto.courseId, sessionDate);

    if (existing && !dto.override) {
      throw new ConflictException(
        'Attendance already marked for this student/course/date. Use override=true to update.',
      );
    }

    if (existing) {
      // Check immutability lock window for non-admin overrides
      this.assertEditable(existing.createdAt, actor);
    }

    const record = await this.repo.upsert(
      dto.studentId,
      dto.courseId,
      sessionDate,
      dto.status,
      actor.sub,
      dto.notes,
    );

    await this.auditLog.log({
      userId: actor.sub,
      action: existing ? 'attendance.overridden' : 'attendance.marked',
      entity: 'Attendance',
      entityId: record.id,
      ipAddress: ip,
      metadata: { studentId: dto.studentId, courseId: dto.courseId, status: dto.status },
    });

    this.events.publish(ATTENDANCE_EVENTS.MARKED, {
      attendanceId: record.id,
      studentId: record.studentId,
      courseId: record.courseId,
      sessionDate: record.sessionDate.toISOString(),
      status: record.status,
    });

    await this.checkLowAttendance(record.studentId, record.courseId);

    return record;
  }

  // ─── Bulk mark ──────────────────────────────────────────────────────────

  async markBulk(dto: BulkAttendanceDto, actor: JwtPayload, ip?: string) {
    const sessionDate = new Date(dto.sessionDate);
    const results: { studentId: string; status: 'created' | 'updated' | 'skipped'; error?: string }[] = [];

    for (const item of dto.records) {
      try {
        const existing = await this.repo.findExisting(item.studentId, dto.courseId, sessionDate);
        if (existing && !dto.override) {
          results.push({ studentId: item.studentId, status: 'skipped', error: 'duplicate' });
          continue;
        }
        if (existing) this.assertEditable(existing.createdAt, actor);

        const record = await this.repo.upsert(
          item.studentId,
          dto.courseId,
          sessionDate,
          item.status,
          actor.sub,
          item.notes,
        );

        results.push({ studentId: item.studentId, status: existing ? 'updated' : 'created' });

        this.events.publish(ATTENDANCE_EVENTS.MARKED, {
          attendanceId: record.id,
          studentId: record.studentId,
          courseId: record.courseId,
          sessionDate: record.sessionDate.toISOString(),
          status: record.status,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        results.push({ studentId: item.studentId, status: 'skipped', error: msg });
      }
    }

    await this.auditLog.log({
      userId: actor.sub,
      action: 'attendance.bulk_marked',
      entity: 'Attendance',
      entityId: dto.courseId,
      ipAddress: ip,
      metadata: { courseId: dto.courseId, sessionDate: dto.sessionDate, count: dto.records.length },
    });

    return { courseId: dto.courseId, sessionDate: dto.sessionDate, results };
  }

  // ─── Update / List ──────────────────────────────────────────────────────

  async update(id: string, dto: UpdateAttendanceDto, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Attendance record not found');
    this.assertEditable(existing.createdAt, actor, dto.override);

    const updated = await this.repo.update(id, {
      status: dto.status,
      notes: dto.notes,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'attendance.updated',
      entity: 'Attendance',
      entityId: id,
      ipAddress: ip,
      metadata: { from: existing.status, to: dto.status },
    });

    return updated;
  }

  async findForStudent(studentId: string, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { items, total } = await this.repo.findForStudent(studentId, page, limit);
    return buildPaginated(items, total, page, limit);
  }

  async findForCourse(courseId: string, sessionDate?: string, pagination?: PaginationDto) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const { items, total } = await this.repo.findForCourse(
      courseId,
      sessionDate ? new Date(sessionDate) : undefined,
      page,
      limit,
    );
    return buildPaginated(items, total, page, limit);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private assertEditable(createdAt: Date, actor: JwtPayload, override = false): void {
    const lockDays = this.config.get<number>('app.attendanceLockDays') ?? 7;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > lockDays && actor.role !== 'Admin' && !override) {
      throw new ForbiddenException(
        `Attendance record is locked after ${lockDays} days. Admin override required.`,
      );
    }
  }

  private async checkLowAttendance(studentId: string, courseId: string): Promise<void> {
    const threshold = this.config.get<number>('app.lowAttendanceThreshold') ?? 75;
    const rate = await this.repo.attendanceRate(studentId, courseId);
    if (rate < threshold) {
      this.events.publish(ATTENDANCE_EVENTS.LOW_DETECTED, {
        studentId,
        courseId,
        rate,
        threshold,
      });
    }
  }
}
