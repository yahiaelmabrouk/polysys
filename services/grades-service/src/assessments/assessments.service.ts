import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentStatus, Prisma } from '@prisma/client';
import { AssessmentsRepository } from './assessments.repository';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';
import { AssessmentFilterDto } from './dto/assessment-filter.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { ASSESSMENT_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { CoursesClient } from '../clients/courses.client';
import { buildPaginated } from '../common/dto/pagination.dto';

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly repo: AssessmentsRepository,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
    private readonly coursesClient: CoursesClient,
  ) {}

  async create(dto: CreateAssessmentDto, actor: JwtPayload, ip?: string) {
    // 1. course must exist + active
    const course = await this.coursesClient.findById(dto.courseId);
    if (!course) {
      throw new BadRequestException('courseId does not reference a known course');
    }
    if (course.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Course "${course.courseCode}" must be ACTIVE to add assessments`,
      );
    }

    // 2. teacher must be assigned (admin always allowed)
    if (actor.role === 'Teacher') {
      const assigned = await this.coursesClient.isTeacherAssignedToCourse(
        actor.sub,
        dto.courseId,
        dto.academicTerm,
        dto.sectionCode ?? undefined,
      );
      if (!assigned) {
        throw new ForbiddenException(
          'Teacher is not assigned to this course/term/section',
        );
      }
    }

    // 3. weights must not exceed 100%
    const sectionKey = dto.sectionCode ?? null;
    const currentSum = await this.repo.sumActiveWeights(
      dto.courseId,
      dto.academicTerm,
      sectionKey,
    );
    if (currentSum + dto.weightPercentage > 100) {
      throw new BadRequestException(
        `Total weight would exceed 100% (current ${currentSum}, adding ${dto.weightPercentage})`,
      );
    }

    // 4. validate dates
    if (dto.dueDate && dto.examDate) {
      // both ok; no rule yet
    }

    const created = await this.repo.create({
      courseId: dto.courseId,
      academicTerm: dto.academicTerm,
      sectionCode: dto.sectionCode ?? null,
      title: dto.title,
      type: dto.type,
      description: dto.description,
      maxScore: new Prisma.Decimal(dto.maxScore),
      weightPercentage: new Prisma.Decimal(dto.weightPercentage),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      examDate: dto.examDate ? new Date(dto.examDate) : null,
      createdByUserId: actor.sub,
      status: dto.status ?? AssessmentStatus.DRAFT,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'assessment.created',
      entity: 'Assessment',
      entityId: created.id,
      ipAddress: ip,
      metadata: {
        courseId: created.courseId,
        academicTerm: created.academicTerm,
        type: created.type,
        weightPercentage: Number(created.weightPercentage),
      },
    });

    this.events.publish(ASSESSMENT_EVENTS.CREATED, {
      assessmentId: created.id,
      courseId: created.courseId,
      academicTerm: created.academicTerm,
      sectionCode: created.sectionCode ?? null,
      type: created.type,
      title: created.title,
      maxScore: Number(created.maxScore),
      weightPercentage: Number(created.weightPercentage),
      status: created.status,
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateAssessmentDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Assessment not found');
    if (existing.status === AssessmentStatus.ARCHIVED) {
      throw new BadRequestException('Archived assessments are read-only');
    }

    if (actor.role === 'Teacher') {
      const assigned = await this.coursesClient.isTeacherAssignedToCourse(
        actor.sub,
        existing.courseId,
        existing.academicTerm,
        existing.sectionCode ?? undefined,
      );
      if (!assigned) {
        throw new ForbiddenException(
          'Teacher is not assigned to this course/term/section',
        );
      }
    }

    // If weight changes, re-validate the 100% constraint excluding this row.
    if (
      dto.weightPercentage !== undefined &&
      dto.weightPercentage !== Number(existing.weightPercentage)
    ) {
      const currentSum = await this.repo.sumActiveWeights(
        existing.courseId,
        existing.academicTerm,
        existing.sectionCode ?? null,
        existing.id,
      );
      if (currentSum + dto.weightPercentage > 100) {
        throw new BadRequestException(
          `Total weight would exceed 100% (other assessments sum ${currentSum})`,
        );
      }
    }

    const update: Prisma.AssessmentUncheckedUpdateInput = {
      title: dto.title,
      type: dto.type,
      description: dto.description,
      maxScore:
        dto.maxScore !== undefined ? new Prisma.Decimal(dto.maxScore) : undefined,
      weightPercentage:
        dto.weightPercentage !== undefined
          ? new Prisma.Decimal(dto.weightPercentage)
          : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      examDate: dto.examDate ? new Date(dto.examDate) : undefined,
      status: dto.status,
      sectionCode: dto.sectionCode,
    };

    const updated = await this.repo.update(id, update);

    await this.auditLog.log({
      userId: actor.sub,
      action: 'assessment.updated',
      entity: 'Assessment',
      entityId: id,
      ipAddress: ip,
      metadata: dto as Record<string, unknown>,
    });

    this.events.publish(ASSESSMENT_EVENTS.UPDATED, {
      assessmentId: updated.id,
      courseId: updated.courseId,
      academicTerm: updated.academicTerm,
    });

    if (dto.status && dto.status !== existing.status) {
      this.events.publish(ASSESSMENT_EVENTS.STATUS_CHANGED, {
        assessmentId: updated.id,
        from: existing.status,
        to: updated.status,
      });
    }

    return updated;
  }

  async findById(id: string) {
    const a = await this.repo.findById(id);
    if (!a) throw new NotFoundException('Assessment not found');
    return a;
  }

  async list(filters: AssessmentFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { items, total } = await this.repo.list({
      courseId: filters.courseId,
      academicTerm: filters.academicTerm,
      sectionCode: filters.sectionCode,
      type: filters.type,
      status: filters.status,
      page,
      limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
    return buildPaginated(items, total, page, limit);
  }

  /**
   * Returns assessments for a course/term used by gradebook & result calculation.
   */
  findForCourseTerm(courseId: string, academicTerm: string, sectionCode?: string) {
    return this.repo.findByCourseTerm(courseId, academicTerm, sectionCode);
  }
}
