import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { DEPARTMENT_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { buildPaginated, PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(
    private readonly repo: DepartmentsRepository,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  async create(dto: CreateDepartmentDto, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(`Department with code "${dto.code}" already exists`);
    }

    const dept = await this.repo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      facultyName: dto.facultyName,
      headUserId: dto.headUserId,
      isActive: dto.isActive ?? true,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'department.created',
      entity: 'Department',
      entityId: dept.id,
      ipAddress: ip,
      metadata: { code: dept.code },
    });

    this.events.publish(DEPARTMENT_EVENTS.CREATED, {
      departmentId: dept.id,
      code: dept.code,
      name: dept.name,
    });

    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Department not found');

    const dept = await this.repo.update(id, {
      name: dto.name,
      description: dto.description,
      facultyName: dto.facultyName,
      headUserId: dto.headUserId,
      isActive: dto.isActive,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'department.updated',
      entity: 'Department',
      entityId: id,
      ipAddress: ip,
      metadata: dto as Record<string, unknown>,
    });

    this.events.publish(DEPARTMENT_EVENTS.UPDATED, {
      departmentId: dept.id,
      code: dept.code,
    });

    return dept;
  }

  async findById(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async list(keyword: string | undefined, isActive: boolean | undefined, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { items, total } = await this.repo.list({ keyword, isActive, page, limit });
    return buildPaginated(items, total, page, limit);
  }
}
