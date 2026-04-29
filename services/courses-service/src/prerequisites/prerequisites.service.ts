import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrerequisiteType } from '@prisma/client';
import { PrerequisitesRepository } from './prerequisites.repository';
import { PrismaService } from '../database/prisma.service';
import { AddPrerequisiteDto } from './dto/prerequisite.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { COURSE_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Injectable()
export class PrerequisitesService {
  private readonly logger = new Logger(PrerequisitesService.name);

  constructor(
    private readonly repo: PrerequisitesRepository,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  async listForCourse(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, courseCode: true, title: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const prerequisites = await this.repo.listForCourse(courseId);
    return { course, prerequisites };
  }

  async add(courseId: string, dto: AddPrerequisiteDto, actor: JwtPayload, ip?: string) {
    if (courseId === dto.prerequisiteCourseId) {
      throw new BadRequestException('A course cannot be its own prerequisite');
    }

    // Validate both courses exist
    const [course, prereq] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: courseId } }),
      this.prisma.course.findUnique({ where: { id: dto.prerequisiteCourseId } }),
    ]);
    if (!course) throw new NotFoundException('Target course not found');
    if (!prereq) throw new NotFoundException('Prerequisite course not found');

    const type = dto.type ?? PrerequisiteType.REQUIRED;

    const existing = await this.repo.findExisting(courseId, dto.prerequisiteCourseId, type);
    if (existing) {
      throw new ConflictException('This prerequisite already exists for the course');
    }

    // Detect circular dependency: walking from `prerequisiteCourseId` upward through
    // its own prerequisites, we must never reach `courseId`.
    await this.assertNoCycle(courseId, dto.prerequisiteCourseId);

    const created = await this.repo.create({
      courseId,
      prerequisiteCourseId: dto.prerequisiteCourseId,
      type,
      minimumGrade: dto.minimumGrade,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'course.prerequisite_added',
      entity: 'CoursePrerequisite',
      entityId: created.id,
      ipAddress: ip,
      metadata: {
        courseId,
        prerequisiteCourseId: dto.prerequisiteCourseId,
        type,
        minimumGrade: dto.minimumGrade,
      },
    });

    this.events.publish(COURSE_EVENTS.PREREQUISITE_CHANGED, {
      courseId,
      change: 'added',
      prerequisiteCourseId: dto.prerequisiteCourseId,
      type,
    });

    return created;
  }

  async remove(courseId: string, prerequisiteId: string, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(prerequisiteId);
    if (!existing) throw new NotFoundException('Prerequisite link not found');
    if (existing.courseId !== courseId) {
      throw new BadRequestException('Prerequisite does not belong to this course');
    }

    await this.repo.delete(prerequisiteId);

    await this.auditLog.log({
      userId: actor.sub,
      action: 'course.prerequisite_removed',
      entity: 'CoursePrerequisite',
      entityId: prerequisiteId,
      ipAddress: ip,
      metadata: { courseId, prerequisiteCourseId: existing.prerequisiteCourseId },
    });

    this.events.publish(COURSE_EVENTS.PREREQUISITE_CHANGED, {
      courseId,
      change: 'removed',
      prerequisiteCourseId: existing.prerequisiteCourseId,
    });

    return { id: prerequisiteId, removed: true };
  }

  /**
   * BFS through the prerequisite chain starting at `startId` and
   * fail if it ever reaches `targetId`.
   */
  private async assertNoCycle(targetId: string, startId: string): Promise<void> {
    const visited = new Set<string>();
    const queue: string[] = [startId];

    while (queue.length) {
      const current = queue.shift() as string;
      if (visited.has(current)) continue;
      visited.add(current);

      if (current === targetId) {
        throw new BadRequestException(
          'Circular prerequisite detected. Adding this rule would create a cycle.',
        );
      }

      const next = await this.repo.getDirectPrereqIds(current);
      for (const id of next) {
        if (!visited.has(id)) queue.push(id);
      }

      // Safety bound to prevent runaway traversals on unexpected data shapes.
      if (visited.size > 5000) {
        throw new BadRequestException(
          'Prerequisite graph traversal exceeded safety threshold; aborting.',
        );
      }
    }
  }
}
