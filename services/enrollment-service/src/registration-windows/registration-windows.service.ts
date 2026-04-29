import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RegistrationRoleScope } from '@prisma/client';
import { RegistrationWindowsRepository } from './registration-windows.repository';
import {
  CreateRegistrationWindowDto,
  UpdateRegistrationWindowDto,
} from './dto/registration-window.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { REGISTRATION_WINDOW_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Injectable()
export class RegistrationWindowsService {
  private readonly logger = new Logger(RegistrationWindowsService.name);

  constructor(
    private readonly repo: RegistrationWindowsRepository,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  list(filters: { academicTerm?: string; isActive?: boolean }) {
    return this.repo.list(filters);
  }

  async findById(id: string) {
    const w = await this.repo.findById(id);
    if (!w) throw new NotFoundException('Registration window not found');
    return w;
  }

  /**
   * Returns the window the actor is allowed to use right now (or throws).
   * Admins are exempt from window enforcement entirely.
   */
  async assertOpenForActor(actor: JwtPayload, academicTerm: string) {
    if (actor.role === 'Admin') return;

    const scope =
      actor.role === 'Student'
        ? RegistrationRoleScope.STUDENT
        : RegistrationRoleScope.ALL;
    const window = await this.repo.findActiveForTerm(academicTerm, scope);
    if (!window) {
      throw new ForbiddenException(
        `No active registration window for term ${academicTerm}`,
      );
    }
    const now = new Date();
    if (now < window.opensAt) {
      throw new ForbiddenException('Registration window has not opened yet');
    }
    if (now > window.closesAt) {
      // Allow late-add if defined
      if (!window.lateAddDeadline || now > window.lateAddDeadline) {
        throw new ForbiddenException('Registration window is closed');
      }
    }
  }

  async assertCanDrop(
    actor: JwtPayload,
    academicTerm: string,
  ): Promise<'drop' | 'withdraw'> {
    if (actor.role === 'Admin') return 'drop';

    const scope = RegistrationRoleScope.STUDENT;
    const window = await this.repo.findActiveForTerm(academicTerm, scope);
    if (!window) {
      throw new ForbiddenException(
        `No active registration window for term ${academicTerm}`,
      );
    }
    const now = new Date();
    if (now <= window.dropDeadline) return 'drop';
    if (now <= window.withdrawDeadline) return 'withdraw';
    throw new ForbiddenException('Drop and withdraw deadlines have passed');
  }

  async create(
    dto: CreateRegistrationWindowDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    this.validateDates(dto);

    const scope = dto.roleScope ?? RegistrationRoleScope.STUDENT;
    try {
      const created = await this.repo.create({
        academicTerm: dto.academicTerm,
        roleScope: scope,
        opensAt: new Date(dto.opensAt),
        closesAt: new Date(dto.closesAt),
        lateAddDeadline: dto.lateAddDeadline
          ? new Date(dto.lateAddDeadline)
          : null,
        dropDeadline: new Date(dto.dropDeadline),
        withdrawDeadline: new Date(dto.withdrawDeadline),
        isActive: dto.isActive ?? true,
      });

      await this.auditLog.log({
        userId: actor.sub,
        action: 'registration_window.created',
        entity: 'RegistrationWindow',
        entityId: created.id,
        ipAddress: ip,
        metadata: { academicTerm: dto.academicTerm, roleScope: scope },
      });

      this.events.publish(REGISTRATION_WINDOW_EVENTS.OPENED, {
        windowId: created.id,
        academicTerm: created.academicTerm,
        roleScope: created.roleScope,
      });

      return created;
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'A registration window for this term and role already exists',
        );
      }
      throw err;
    }
  }

  async update(
    id: string,
    dto: UpdateRegistrationWindowDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const existing = await this.findById(id);

    const merged = {
      opensAt: dto.opensAt ? new Date(dto.opensAt) : existing.opensAt,
      closesAt: dto.closesAt ? new Date(dto.closesAt) : existing.closesAt,
      lateAddDeadline:
        dto.lateAddDeadline !== undefined
          ? new Date(dto.lateAddDeadline)
          : existing.lateAddDeadline,
      dropDeadline: dto.dropDeadline
        ? new Date(dto.dropDeadline)
        : existing.dropDeadline,
      withdrawDeadline: dto.withdrawDeadline
        ? new Date(dto.withdrawDeadline)
        : existing.withdrawDeadline,
    };
    if (merged.closesAt < merged.opensAt) {
      throw new BadRequestException('closesAt must be after opensAt');
    }
    if (merged.dropDeadline < merged.opensAt) {
      throw new BadRequestException('dropDeadline must be after opensAt');
    }
    if (merged.withdrawDeadline < merged.dropDeadline) {
      throw new BadRequestException(
        'withdrawDeadline must be after dropDeadline',
      );
    }

    const updated = await this.repo.update(id, {
      opensAt: merged.opensAt,
      closesAt: merged.closesAt,
      lateAddDeadline: merged.lateAddDeadline,
      dropDeadline: merged.dropDeadline,
      withdrawDeadline: merged.withdrawDeadline,
      isActive: dto.isActive,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'registration_window.updated',
      entity: 'RegistrationWindow',
      entityId: id,
      ipAddress: ip,
      metadata: dto as Record<string, unknown>,
    });

    this.events.publish(REGISTRATION_WINDOW_EVENTS.UPDATED, {
      windowId: id,
      academicTerm: updated.academicTerm,
    });

    return updated;
  }

  private validateDates(dto: CreateRegistrationWindowDto) {
    const opens = new Date(dto.opensAt);
    const closes = new Date(dto.closesAt);
    const drop = new Date(dto.dropDeadline);
    const withdraw = new Date(dto.withdrawDeadline);
    if (Number.isNaN(opens.getTime())) {
      throw new BadRequestException('opensAt is not a valid date');
    }
    if (closes < opens) {
      throw new BadRequestException('closesAt must be after opensAt');
    }
    if (drop < opens) {
      throw new BadRequestException('dropDeadline must be after opensAt');
    }
    if (withdraw < drop) {
      throw new BadRequestException(
        'withdrawDeadline must be after dropDeadline',
      );
    }
  }
}
