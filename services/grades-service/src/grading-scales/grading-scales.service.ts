import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GradingScale, Prisma } from '@prisma/client';
import { GradingScalesRepository } from './grading-scales.repository';
import {
  CreateGradingScaleDto,
  UpdateGradingScaleDto,
} from './dto/grading-scale.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { JwtPayload } from '../strategies/jwt-access.strategy';

export interface LetterGradeResolution {
  letterGrade: string;
  gradePoints: number;
}

@Injectable()
export class GradingScalesService {
  private readonly logger = new Logger(GradingScalesService.name);

  constructor(
    private readonly repo: GradingScalesRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  list(name?: string) {
    return this.repo.list(name);
  }

  async findById(id: string) {
    const scale = await this.repo.findById(id);
    if (!scale) throw new NotFoundException('Grading scale entry not found');
    return scale;
  }

  async create(dto: CreateGradingScaleDto, actor: JwtPayload, ip?: string) {
    if (dto.minPercentage > dto.maxPercentage) {
      throw new BadRequestException('minPercentage cannot exceed maxPercentage');
    }

    // Validate non-overlapping bands inside the same scale name
    const existing = await this.repo.list(dto.name);
    for (const b of existing) {
      const aMin = Number(b.minPercentage);
      const aMax = Number(b.maxPercentage);
      if (dto.minPercentage <= aMax && dto.maxPercentage >= aMin) {
        throw new BadRequestException(
          `Overlapping band with existing letter "${b.letterGrade}" (${aMin}-${aMax})`,
        );
      }
    }

    const created = await this.repo.create({
      name: dto.name,
      letterGrade: dto.letterGrade,
      minPercentage: new Prisma.Decimal(dto.minPercentage),
      maxPercentage: new Prisma.Decimal(dto.maxPercentage),
      gradePoints: new Prisma.Decimal(dto.gradePoints),
      isActive: dto.isActive ?? true,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'grading_scale.created',
      entity: 'GradingScale',
      entityId: created.id,
      ipAddress: ip,
      metadata: { name: created.name, letterGrade: created.letterGrade },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateGradingScaleDto,
    actor: JwtPayload,
    ip?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Grading scale entry not found');

    const update: Prisma.GradingScaleUncheckedUpdateInput = {
      minPercentage:
        dto.minPercentage !== undefined
          ? new Prisma.Decimal(dto.minPercentage)
          : undefined,
      maxPercentage:
        dto.maxPercentage !== undefined
          ? new Prisma.Decimal(dto.maxPercentage)
          : undefined,
      gradePoints:
        dto.gradePoints !== undefined
          ? new Prisma.Decimal(dto.gradePoints)
          : undefined,
      isActive: dto.isActive,
    };

    const updated = await this.repo.update(id, update);

    await this.auditLog.log({
      userId: actor.sub,
      action: 'grading_scale.updated',
      entity: 'GradingScale',
      entityId: id,
      ipAddress: ip,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }

  async remove(id: string, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Grading scale entry not found');
    await this.repo.delete(id);

    await this.auditLog.log({
      userId: actor.sub,
      action: 'grading_scale.deleted',
      entity: 'GradingScale',
      entityId: id,
      ipAddress: ip,
    });

    return { id, deleted: true };
  }

  /**
   * Resolves a percentage score to a letter grade + grade points using
   * the active scale identified by `scaleName`. Defaults to "default".
   *
   * Deterministic: bands are scanned highest-min first; the first band
   * matching `min <= percentage <= max` wins. If no band matches (e.g.
   * percentage > 100 or < 0), throws BadRequestException so callers
   * cannot silently produce a wrong grade.
   */
  async resolveLetterGrade(
    percentage: number,
    scaleName = 'default',
  ): Promise<LetterGradeResolution> {
    if (percentage < 0 || percentage > 100) {
      throw new BadRequestException(
        `Percentage out of range [0..100]: ${percentage}`,
      );
    }
    const scale = await this.repo.findActive(scaleName);
    if (!scale.length) {
      throw new BadRequestException(
        `No active grading scale "${scaleName}" configured`,
      );
    }
    for (const band of scale) {
      const min = Number(band.minPercentage);
      const max = Number(band.maxPercentage);
      if (percentage >= min && percentage <= max) {
        return {
          letterGrade: band.letterGrade,
          gradePoints: Number(band.gradePoints),
        };
      }
    }
    throw new BadRequestException(
      `No grading band matched percentage ${percentage} on scale "${scaleName}"`,
    );
  }

  /**
   * Maps each percentage in the input array to a letter grade resolution.
   * Loads the scale once for performance.
   */
  async resolveBatch(
    percentages: number[],
    scaleName = 'default',
  ): Promise<LetterGradeResolution[]> {
    const scale = await this.repo.findActive(scaleName);
    if (!scale.length) {
      throw new BadRequestException(
        `No active grading scale "${scaleName}" configured`,
      );
    }
    return percentages.map((p) => this.matchInScale(p, scale, scaleName));
  }

  private matchInScale(
    percentage: number,
    scale: GradingScale[],
    scaleName: string,
  ): LetterGradeResolution {
    if (percentage < 0 || percentage > 100) {
      throw new BadRequestException(
        `Percentage out of range [0..100]: ${percentage}`,
      );
    }
    for (const band of scale) {
      const min = Number(band.minPercentage);
      const max = Number(band.maxPercentage);
      if (percentage >= min && percentage <= max) {
        return {
          letterGrade: band.letterGrade,
          gradePoints: Number(band.gradePoints),
        };
      }
    }
    throw new BadRequestException(
      `No grading band matched percentage ${percentage} on scale "${scaleName}"`,
    );
  }
}
