import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, CourseStatus } from '@prisma/client';
import { TeacherAssignmentsRepository } from './teacher-assignments.repository';
import { PrismaService } from '../database/prisma.service';
import {
  AssignTeacherDto,
  UpdateTeacherAssignmentDto,
} from './dto/teacher-assignment.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { TEACHER_EVENTS } from '../events/event-names';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Injectable()
export class TeacherAssignmentsService {
  private readonly logger = new Logger(TeacherAssignmentsService.name);

  constructor(
    private readonly repo: TeacherAssignmentsRepository,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  async assign(dto: Required<Pick<AssignTeacherDto, 'courseId'>> & AssignTeacherDto, actor: JwtPayload, ip?: string) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status === CourseStatus.ARCHIVED) {
      throw new BadRequestException('Cannot assign teacher to an archived course');
    }

    const dup = await this.repo.findExisting(dto.courseId, dto.academicTerm, dto.sectionCode);
    if (dup && dup.status === AssignmentStatus.ACTIVE) {
      throw new ConflictException(
        `Section "${dto.sectionCode}" for ${dto.academicTerm} is already assigned`,
      );
    }

    const created = dup
      ? await this.repo.update(dup.id, {
          teacherUserId: dto.teacherUserId,
          maxStudents: dto.maxStudents,
          status: AssignmentStatus.ACTIVE,
          assignedByUserId: actor.sub,
        })
      : await this.repo.create({
          courseId: dto.courseId,
          teacherUserId: dto.teacherUserId,
          academicTerm: dto.academicTerm,
          sectionCode: dto.sectionCode,
          maxStudents: dto.maxStudents,
          assignedByUserId: actor.sub,
          status: AssignmentStatus.ACTIVE,
        });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'teacher.assigned_to_course',
      entity: 'TeacherAssignment',
      entityId: created.id,
      ipAddress: ip,
      metadata: {
        courseId: dto.courseId,
        teacherUserId: dto.teacherUserId,
        academicTerm: dto.academicTerm,
        sectionCode: dto.sectionCode,
      },
    });

    this.events.publish(TEACHER_EVENTS.ASSIGNED_TO_COURSE, {
      assignmentId: created.id,
      courseId: dto.courseId,
      courseCode: course.courseCode,
      teacherUserId: dto.teacherUserId,
      academicTerm: dto.academicTerm,
      sectionCode: dto.sectionCode,
    });

    return created;
  }

  async update(id: string, dto: UpdateTeacherAssignmentDto, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Teacher assignment not found');

    const updated = await this.repo.update(id, {
      academicTerm: dto.academicTerm,
      sectionCode: dto.sectionCode,
      maxStudents: dto.maxStudents,
      status: dto.status,
    });

    await this.auditLog.log({
      userId: actor.sub,
      action: 'teacher.assignment_updated',
      entity: 'TeacherAssignment',
      entityId: id,
      ipAddress: ip,
      metadata: dto as Record<string, unknown>,
    });

    this.events.publish(TEACHER_EVENTS.ASSIGNMENT_UPDATED, {
      assignmentId: id,
      courseId: existing.courseId,
      teacherUserId: existing.teacherUserId,
    });

    return updated;
  }

  async remove(id: string, actor: JwtPayload, ip?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Teacher assignment not found');

    await this.repo.softDelete(id);

    await this.auditLog.log({
      userId: actor.sub,
      action: 'teacher.assignment_removed',
      entity: 'TeacherAssignment',
      entityId: id,
      ipAddress: ip,
      metadata: {
        courseId: existing.courseId,
        teacherUserId: existing.teacherUserId,
      },
    });

    this.events.publish(TEACHER_EVENTS.ASSIGNMENT_REMOVED, {
      assignmentId: id,
      courseId: existing.courseId,
      teacherUserId: existing.teacherUserId,
    });

    return { id, removed: true };
  }

  listForTeacher(teacherUserId: string) {
    return this.repo.listByTeacher(teacherUserId);
  }

  listForCourse(courseId: string) {
    return this.repo.listByCourse(courseId);
  }
}
