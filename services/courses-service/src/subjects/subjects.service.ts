import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SubjectsRepository } from './subjects.repository';
import { DepartmentsRepository } from '../departments/departments.repository';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { SUBJECT_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { buildPaginated, PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);

  constructor(
    private readonly repo: SubjectsRepository,
    private readonly departments: DepartmentsRepository,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  async create(dto: CreateSubjectDto, actor: JwtPayload, ip?: string) {
    const dept = await this.departments.findById(dto.departmentId);
    if (!dept) throw new BadRequestException('departmentId does not reference a known department');
    if (!dept.isActive) throw new BadRequestException('Cannot attach subject to an inactive department');

    const dup = await this.repo.findByCode(dto.code);
    if (dup) throw new ConflictException(`Subject code "${dto.code}" already exists`);

    const subject = await this.repo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      departmentId: dto.departmentId,
      isActive: dto.isActive ?? true,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'subject.created',
      entity: 'Subject',
      entityId: subject.id,
      ipAddress: ip,
      metadata: { code: subject.code, departmentId: dept.id },
    });

    this.events.publish(SUBJECT_EVENTS.CREATED, {
      subjectId: subject.id,
      code: subject.code,
      departmentId: subject.departmentId,
    });

    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Subject not found');

    if (dto.departmentId) {
      const dept = await this.departments.findById(dto.departmentId);
      if (!dept) throw new BadRequestException('departmentId does not reference a known department');
    }

    const subject = await this.repo.update(id, {
      name: dto.name,
      description: dto.description,
      departmentId: dto.departmentId,
      isActive: dto.isActive,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'subject.updated',
      entity: 'Subject',
      entityId: id,
      ipAddress: ip,
      metadata: dto as Record<string, unknown>,
    });

    this.events.publish(SUBJECT_EVENTS.UPDATED, {
      subjectId: subject.id,
      code: subject.code,
    });

    return subject;
  }

  async findById(id: string) {
    const subject = await this.repo.findById(id);
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async list(
    keyword: string | undefined,
    departmentId: string | undefined,
    isActive: boolean | undefined,
    pagination: PaginationDto,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { items, total } = await this.repo.list({ keyword, departmentId, isActive, page, limit });
    return buildPaginated(items, total, page, limit);
  }
}
