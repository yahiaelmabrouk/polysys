import { randomBytes } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranscriptStatus } from '@prisma/client';
import { TranscriptsRepository } from './transcripts.repository';
import {
  ApproveTranscriptDto,
  RejectTranscriptDto,
  RequestTranscriptDto,
  TranscriptListDto,
} from './dto/transcript.dto';
import { ResultsService } from '../results/results.service';
import { GpaService } from '../gpa/gpa.service';
import { CoursesClient } from '../clients/courses.client';
import { StudentsClient } from '../clients/students.client';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { TRANSCRIPT_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { buildPaginated } from '../common/dto/pagination.dto';
import { requireStudentId } from '../common/utils/actor.util';

@Injectable()
export class TranscriptsService {
  private readonly logger = new Logger(TranscriptsService.name);

  constructor(
    private readonly repo: TranscriptsRepository,
    private readonly results: ResultsService,
    private readonly gpa: GpaService,
    private readonly coursesClient: CoursesClient,
    private readonly studentsClient: StudentsClient,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
    private readonly config: ConfigService,
  ) {}

  // ─── Student-facing ────────────────────────────────────────────────────

  myTranscripts(actor: JwtPayload) {
    const studentId = requireStudentId(actor);
    return this.repo.findByStudent(studentId);
  }

  async request(dto: RequestTranscriptDto, actor: JwtPayload, ip?: string) {
    const studentId = requireStudentId(actor);
    const transcriptNumber = await this.generateTranscriptNumber();

    const created = await this.repo.create({
      studentId,
      transcriptNumber,
      requestType: dto.requestType,
      status: TranscriptStatus.REQUESTED,
      payloadSnapshot: undefined as unknown as object, // filled on approval
      notes: dto.notes,
      requestedByUserId: actor.sub,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'transcript.requested',
      entity: 'Transcript',
      entityId: created.id,
      ipAddress: ip,
      metadata: {
        studentId,
        transcriptNumber,
        requestType: dto.requestType,
      },
    });

    this.events.publish(TRANSCRIPT_EVENTS.REQUESTED, {
      transcriptId: created.id,
      studentId,
      transcriptNumber,
      requestType: dto.requestType,
    });

    return created;
  }

  // ─── Admin-facing ──────────────────────────────────────────────────────

  async list(filters: TranscriptListDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { items, total } = await this.repo.list({
      studentId: filters.studentId,
      status: filters.status,
      requestType: filters.requestType,
      page,
      limit,
    });
    return buildPaginated(items, total, page, limit);
  }

  async approve(
    id: string,
    dto: ApproveTranscriptDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    if (actor.role !== 'Admin') {
      throw new ForbiddenException('Only Admin can approve transcripts');
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Transcript not found');
    if (existing.status === TranscriptStatus.COMPLETED) {
      return existing;
    }

    // Build the snapshot at approval time
    const payload = await this.buildPayloadSnapshot(existing.studentId);

    const updated = await this.repo.update(id, {
      status: TranscriptStatus.COMPLETED,
      completedAt: new Date(),
      processedByUserId: actor.sub,
      payloadSnapshot: payload as unknown as object,
      notes: dto.notes ?? existing.notes,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'transcript.completed',
      entity: 'Transcript',
      entityId: id,
      ipAddress: ip,
      metadata: {
        studentId: existing.studentId,
        transcriptNumber: existing.transcriptNumber,
      },
    });

    this.events.publish(TRANSCRIPT_EVENTS.COMPLETED, {
      transcriptId: id,
      studentId: existing.studentId,
      transcriptNumber: existing.transcriptNumber,
    });

    return updated;
  }

  async reject(
    id: string,
    dto: RejectTranscriptDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    if (actor.role !== 'Admin') {
      throw new ForbiddenException('Only Admin can reject transcripts');
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Transcript not found');

    const updated = await this.repo.update(id, {
      status: TranscriptStatus.REJECTED,
      processedByUserId: actor.sub,
      notes: dto.reason,
      completedAt: new Date(),
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'transcript.rejected',
      entity: 'Transcript',
      entityId: id,
      ipAddress: ip,
      metadata: {
        studentId: existing.studentId,
        reason: dto.reason,
      },
    });

    this.events.publish(TRANSCRIPT_EVENTS.REJECTED, {
      transcriptId: id,
      studentId: existing.studentId,
      reason: dto.reason,
    });

    return updated;
  }

  // ─── Internal: latest snapshot for a student ───────────────────────────

  async getLatestSnapshot(studentId: string) {
    const t = await this.repo.findLatestCompletedByStudent(studentId);
    if (!t) return null;
    return {
      transcriptId: t.id,
      transcriptNumber: t.transcriptNumber,
      completedAt: t.completedAt,
      payload: t.payloadSnapshot,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async generateTranscriptNumber(): Promise<string> {
    const prefix =
      this.config.get<string>('app.transcriptNumberPrefix') ?? 'TR';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;
      const existing = await this.repo.findByNumber(candidate);
      if (!existing) return candidate;
    }
    throw new Error('Failed to generate a unique transcript number');
  }

  private async buildPayloadSnapshot(studentId: string) {
    const [student, results, gpaSnapshots] = await Promise.all([
      this.studentsClient.findById(studentId).catch(() => null),
      this.results.findByStudent(studentId),
      this.gpa.getStudentSnapshots(studentId),
    ]);

    // group results by term
    const termMap: Record<
      string,
      Array<Record<string, unknown>>
    > = {};
    const courseCache = new Map<string, { code?: string; title?: string }>();
    for (const r of results) {
      let courseInfo = courseCache.get(r.courseId);
      if (!courseInfo) {
        const c = await this.coursesClient.findById(r.courseId).catch(() => null);
        courseInfo = c
          ? { code: (c as { code?: string }).code, title: (c as { title?: string }).title }
          : {};
        courseCache.set(r.courseId, courseInfo);
      }
      (termMap[r.academicTerm] ??= []).push({
        courseId: r.courseId,
        courseCode: courseInfo.code ?? null,
        courseTitle: courseInfo.title ?? null,
        weightedScore: Number(r.weightedScore),
        letterGrade: r.letterGrade,
        gradePoints: Number(r.gradePoints),
        creditsEarned: Number(r.creditsEarned),
        resultStatus: r.resultStatus,
      });
    }

    const terms = Object.keys(termMap)
      .sort()
      .map((term) => {
        const snap = gpaSnapshots.find((g) => g.academicTerm === term);
        return {
          academicTerm: term,
          courses: termMap[term],
          termGpa: snap ? Number(snap.termGpa) : null,
          cumulativeGpa: snap ? Number(snap.cumulativeGpa) : null,
          academicStanding: snap?.academicStanding ?? null,
        };
      });

    const latest = gpaSnapshots[gpaSnapshots.length - 1];

    return {
      studentId,
      student,
      generatedAt: new Date().toISOString(),
      terms,
      summary: {
        cumulativeGpa: latest ? Number(latest.cumulativeGpa) : null,
        creditsAttempted: latest ? Number(latest.creditsAttempted) : 0,
        creditsEarned: latest ? Number(latest.creditsEarned) : 0,
        academicStanding: latest?.academicStanding ?? null,
      },
    };
  }
}
