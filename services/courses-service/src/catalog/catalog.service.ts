import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateCatalogVersionDto,
  UpdateCatalogVersionDto,
} from './dto/catalog.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list() {
    return this.prisma.catalogVersion.findMany({
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getCurrent() {
    return this.prisma.catalogVersion.findFirst({ where: { isCurrent: true } });
  }

  async create(dto: CreateCatalogVersionDto, actor: JwtPayload, ip?: string) {
    const dup = await this.prisma.catalogVersion.findUnique({
      where: { versionName: dto.versionName },
    });
    if (dup) throw new ConflictException(`Catalog version "${dto.versionName}" already exists`);

    const version = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) {
        await tx.catalogVersion.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false },
        });
      }
      return tx.catalogVersion.create({
        data: {
          versionName: dto.versionName,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          isCurrent: dto.isCurrent ?? false,
          notes: dto.notes,
        },
      });
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'catalog_version.created',
      entity: 'CatalogVersion',
      entityId: version.id,
      ipAddress: ip,
      metadata: { versionName: version.versionName },
    });

    return version;
  }

  async update(id: string, dto: UpdateCatalogVersionDto, actor: JwtPayload, ip?: string) {
    const existing = await this.prisma.catalogVersion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Catalog version not found');

    const version = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent === true) {
        await tx.catalogVersion.updateMany({
          where: { isCurrent: true, NOT: { id } },
          data: { isCurrent: false },
        });
      }
      return tx.catalogVersion.update({
        where: { id },
        data: {
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          isCurrent: dto.isCurrent,
          notes: dto.notes,
        },
      });
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'catalog_version.updated',
      entity: 'CatalogVersion',
      entityId: id,
      ipAddress: ip,
      metadata: dto as Record<string, unknown>,
    });

    return version;
  }
}
