import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourseStatus, Prisma } from '@prisma/client';
import slugify from 'slugify';
import { CoursesRepository } from './courses.repository';
import { DepartmentsRepository } from '../departments/departments.repository';
import { SubjectsRepository } from '../subjects/subjects.repository';
import {
  CreateCourseDto,
  UpdateCourseDto,
  UpdateCourseStatusDto,
} from './dto/course.dto';
import { CourseFilterDto } from './dto/course-filter.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { COURSE_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { buildPaginated } from '../common/dto/pagination.dto';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly repo: CoursesRepository,
    private readonly departments: DepartmentsRepository,
    private readonly subjects: SubjectsRepository,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────────────

  async create(dto: CreateCourseDto, actor: JwtPayload, ip?: string) {
    // 1. validate unique course_code
    const dup = await this.repo.findByCode(dto.courseCode);
    if (dup) throw new ConflictException(`Course code "${dto.courseCode}" already exists`);

    // 2. validate department
    const dept = await this.departments.findById(dto.departmentId);
    if (!dept) throw new BadRequestException('departmentId does not reference a known department');
    if (!dept.isActive) throw new BadRequestException('Department is inactive');

    // 3. validate subject
    const subject = await this.subjects.findById(dto.subjectId);
    if (!subject) throw new BadRequestException('subjectId does not reference a known subject');
    if (subject.departmentId !== dept.id) {
      throw new BadRequestException('Subject does not belong to the specified department');
    }

    // 4. validate credits
    this.validateCredits(dto.credits);

    // 5. validate active courses must have credits > 0
    const status = dto.status ?? CourseStatus.DRAFT;
    if (status === CourseStatus.ACTIVE && (!dto.credits || dto.credits <= 0)) {
      throw new BadRequestException('Active courses must have credits > 0');
    }

    const slug = dto.slug || slugify(`${dto.courseCode}-${dto.title}`, { lower: true, strict: true });

    // 6. save
    const course = await this.repo.create({
      courseCode: dto.courseCode,
      title: dto.title,
      slug,
      subjectId: dto.subjectId,
      departmentId: dto.departmentId,
      description: dto.description,
      credits: new Prisma.Decimal(dto.credits),
      level: dto.level,
      semesterType: dto.semesterType,
      capacityDefault: dto.capacityDefault,
      durationWeeks: dto.durationWeeks,
      language: dto.language,
      deliveryMode: dto.deliveryMode,
      status,
      createdByUserId: actor.sub,
    });

    if (dto.tags && dto.tags.length) {
      await this.repo.replaceTags(course.id, dto.tags);
    }

    await this.auditLog.log({
      userId: actor.sub,
      action: 'course.created',
      entity: 'Course',
      entityId: course.id,
      ipAddress: ip,
      metadata: { courseCode: course.courseCode, status },
    });

    // 7. publish event
    this.events.publish(COURSE_EVENTS.CREATED, {
      courseId: course.id,
      courseCode: course.courseCode,
      title: course.title,
      departmentId: course.departmentId,
      subjectId: course.subjectId,
      credits: Number(course.credits),
      level: course.level,
      status: course.status,
    });

    return this.repo.findById(course.id, true);
  }

  // ─── Update ─────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateCourseDto, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Course not found');

    if (existing.status === CourseStatus.ARCHIVED) {
      throw new BadRequestException('Archived courses are read-only. Restore status first.');
    }

    if (dto.departmentId) {
      const dept = await this.departments.findById(dto.departmentId);
      if (!dept) throw new BadRequestException('departmentId not found');
    }
    if (dto.subjectId) {
      const subject = await this.subjects.findById(dto.subjectId);
      if (!subject) throw new BadRequestException('subjectId not found');
      const targetDeptId = dto.departmentId ?? existing.departmentId;
      if (subject.departmentId !== targetDeptId) {
        throw new BadRequestException('Subject does not belong to the specified department');
      }
    }

    if (dto.credits !== undefined) this.validateCredits(dto.credits);

    const update: Prisma.CourseUncheckedUpdateInput = {
      title: dto.title,
      slug: dto.slug,
      subjectId: dto.subjectId,
      departmentId: dto.departmentId,
      description: dto.description,
      credits: dto.credits !== undefined ? new Prisma.Decimal(dto.credits) : undefined,
      level: dto.level,
      semesterType: dto.semesterType,
      capacityDefault: dto.capacityDefault,
      durationWeeks: dto.durationWeeks,
      language: dto.language,
      deliveryMode: dto.deliveryMode,
    };

    const course = await this.repo.update(id, update);

    if (dto.tags) {
      await this.repo.replaceTags(course.id, dto.tags);
    }

    await this.auditLog.log({
      userId: actor.sub,
      action: 'course.updated',
      entity: 'Course',
      entityId: id,
      ipAddress: ip,
      metadata: dto as Record<string, unknown>,
    });

    this.events.publish(COURSE_EVENTS.UPDATED, {
      courseId: course.id,
      courseCode: course.courseCode,
    });

    return this.repo.findById(course.id, true);
  }

  // ─── Status transitions ────────────────────────────────────────────────

  async changeStatus(id: string, dto: UpdateCourseStatusDto, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Course not found');

    if (existing.status === dto.status) {
      return existing;
    }

    if (dto.status === CourseStatus.ACTIVE && Number(existing.credits) <= 0) {
      throw new BadRequestException('Cannot activate a course without credits');
    }

    const course = await this.repo.update(id, { status: dto.status });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'course.status_changed',
      entity: 'Course',
      entityId: id,
      ipAddress: ip,
      metadata: { from: existing.status, to: dto.status, reason: dto.reason },
    });

    this.events.publish(COURSE_EVENTS.STATUS_CHANGED, {
      courseId: course.id,
      courseCode: course.courseCode,
      from: existing.status,
      to: course.status,
    });

    if (dto.status === CourseStatus.ARCHIVED) {
      this.events.publish(COURSE_EVENTS.ARCHIVED, {
        courseId: course.id,
        courseCode: course.courseCode,
        reason: dto.reason,
      });
    }

    return course;
  }

  // ─── Delete ────────────────────────────────────────────────────────────

  async remove(id: string, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Course not found');

    if (existing.status === CourseStatus.ACTIVE) {
      throw new BadRequestException(
        'Active courses cannot be deleted. Archive the course first to preserve history.',
      );
    }

    await this.repo.delete(id);

    await this.auditLog.log({
      userId: actor.sub,
      action: 'course.deleted',
      entity: 'Course',
      entityId: id,
      ipAddress: ip,
      metadata: { courseCode: existing.courseCode },
    });

    this.events.publish(COURSE_EVENTS.DELETED, {
      courseId: id,
      courseCode: existing.courseCode,
    });

    return { id, deleted: true };
  }

  // ─── Reads ─────────────────────────────────────────────────────────────

  async findById(id: string, includePrerequisites = true) {
    const course = await this.repo.findById(id, includePrerequisites);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async findByCode(courseCode: string, includePrerequisites = true) {
    const course = await this.repo.findByCode(courseCode, includePrerequisites);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async list(filters: CourseFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const { items, total } = await this.repo.list({
      keyword: filters.keyword,
      departmentId: filters.departmentId,
      subjectId: filters.subjectId,
      credits: filters.credits,
      level: filters.level,
      semesterType: filters.semesterType,
      deliveryMode: filters.deliveryMode,
      status: filters.status,
      teacherId: filters.teacherId,
      includePrerequisites: filters.includePrerequisites === 'true',
      page,
      limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
    return buildPaginated(items, total, page, limit);
  }

  async findCoursesForTeacher(teacherUserId: string, page = 1, limit = 20) {
    const [items, total] = await this.repo.findByTeacher(teacherUserId, page, limit);
    return buildPaginated(items, total, page, limit);
  }

  getEligibilityRules(id: string) {
    return this.repo.getEligibilityRules(id);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private validateCredits(credits: number): void {
    const min = this.config.get<number>('app.minCourseCredits') ?? 1;
    const max = this.config.get<number>('app.maxCourseCredits') ?? 10;
    const allowDecimal = this.config.get<boolean>('app.allowDecimalCredits') ?? false;

    if (credits < min || credits > max) {
      throw new BadRequestException(`credits must be between ${min} and ${max}`);
    }
    if (!allowDecimal && !Number.isInteger(credits)) {
      throw new BadRequestException('Decimal credits are not allowed; use an integer value');
    }
  }
}
