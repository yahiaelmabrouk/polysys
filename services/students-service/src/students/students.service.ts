import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EnrollmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { StudentsRepository } from './students.repository';
import {
  CreateStudentDto,
  UpdateStudentDto,
  UpdateStudentStatusDto,
  UpdateOwnContactDto,
  StudentSearchDto,
} from './dto/student.dto';
import { buildPaginated, PaginatedResult } from '../common/dto/pagination.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { STUDENT_EVENTS } from '../events/event-names';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: StudentsRepository,
    private readonly auditLog: AuditLogService,
    private readonly events: EventPublisherService,
  ) {}

  // ─── Read ───────────────────────────────────────────────────────────────

  async findById(id: string) {
    const student = await this.repo.findById(id);
    if (!student) throw new NotFoundException(`Student ${id} not found`);
    return student;
  }

  async findByAuthUserId(authUserId: string) {
    const student = await this.repo.findByAuthUserId(authUserId);
    if (!student) throw new NotFoundException('Student record not found for this user');
    return student;
  }

  async findByStudentNumber(studentNumber: string) {
    const student = await this.repo.findByStudentNumber(studentNumber);
    if (!student) throw new NotFoundException(`Student number ${studentNumber} not found`);
    return student;
  }

  async getStatus(id: string) {
    const s = await this.findById(id);
    return {
      id: s.id,
      studentNumber: s.studentNumber,
      enrollmentStatus: s.enrollmentStatus,
      currentLevel: s.currentLevel,
      programName: s.programName,
    };
  }

  async search(filters: StudentSearchDto): Promise<PaginatedResult<unknown>> {
    const { items, total } = await this.repo.search(filters);
    return buildPaginated(items, total, filters.page ?? 1, filters.limit ?? 20);
  }

  // ─── Create ─────────────────────────────────────────────────────────────

  async create(dto: CreateStudentDto, actorUserId?: string, ip?: string): Promise<unknown> {
    // Enforce 1:1 mapping with Auth user
    const existing = await this.prisma.student.findUnique({ where: { authUserId: dto.authUserId } });
    if (existing) {
      throw new ConflictException('A student record already exists for this auth user');
    }

    const studentNumber = dto.studentNumber ?? (await this.generateStudentNumber(dto.admissionDate));

    const student = await this.prisma.student.create({
      data: {
        authUserId: dto.authUserId,
        studentNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        nationality: dto.nationality,
        nationalId: dto.nationalId,
        admissionDate: new Date(dto.admissionDate),
        expectedGraduationDate: dto.expectedGraduationDate ? new Date(dto.expectedGraduationDate) : null,
        departmentId: dto.departmentId,
        programName: dto.programName,
        currentLevel: dto.currentLevel ?? 1,
        enrollmentStatus: dto.enrollmentStatus ?? EnrollmentStatus.ACTIVE,
        advisorId: dto.advisorId,
        profile: {
          create: {}, // empty default profile
        },
      },
      include: { profile: true, contacts: true },
    });

    await this.auditLog.log({
      userId: actorUserId,
      action: 'student.created',
      entity: 'Student',
      entityId: student.id,
      ipAddress: ip,
      metadata: { studentNumber: student.studentNumber },
    });

    this.events.publish(STUDENT_EVENTS.CREATED, {
      studentId: student.id,
      authUserId: student.authUserId,
      studentNumber: student.studentNumber,
      programName: student.programName,
      enrollmentStatus: student.enrollmentStatus,
    });

    return student;
  }

  // ─── Update (Admin) ─────────────────────────────────────────────────────

  async update(id: string, dto: UpdateStudentDto, actorUserId?: string, ip?: string) {
    await this.assertExists(id);
    const data: Prisma.StudentUpdateInput = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      gender: dto.gender,
      nationality: dto.nationality,
      nationalId: dto.nationalId,
      expectedGraduationDate: dto.expectedGraduationDate ? new Date(dto.expectedGraduationDate) : undefined,
      departmentId: dto.departmentId,
      programName: dto.programName,
      currentLevel: dto.currentLevel,
      advisorId: dto.advisorId,
    };
    const updated = await this.repo.update(id, data);

    await this.auditLog.log({
      userId: actorUserId,
      action: 'student.updated',
      entity: 'Student',
      entityId: id,
      ipAddress: ip,
      metadata: { fields: Object.keys(dto) },
    });

    this.events.publish(STUDENT_EVENTS.UPDATED, {
      studentId: updated.id,
      changedFields: Object.keys(dto),
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateStudentStatusDto, actorUserId?: string, ip?: string) {
    const current = await this.findById(id);
    if (current.enrollmentStatus === dto.status) {
      return current; // no-op
    }
    const updated = await this.repo.updateStatus(id, dto.status);

    await this.auditLog.log({
      userId: actorUserId,
      action: 'student.status_changed',
      entity: 'Student',
      entityId: id,
      ipAddress: ip,
      metadata: { from: current.enrollmentStatus, to: dto.status, reason: dto.reason },
    });

    this.events.publish(STUDENT_EVENTS.STATUS_CHANGED, {
      studentId: id,
      from: current.enrollmentStatus,
      to: dto.status,
      reason: dto.reason,
    });

    return updated;
  }

  // ─── Self-Service ───────────────────────────────────────────────────────

  async updateOwnContact(authUserId: string, dto: UpdateOwnContactDto, ip?: string) {
    const student = await this.findByAuthUserId(authUserId);

    const updated = await this.prisma.studentProfile.update({
      where: { studentId: student.id },
      data: {
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        stateRegion: dto.stateRegion,
        postalCode: dto.postalCode,
        country: dto.country,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        emergencyContactRelation: dto.emergencyContactRelation,
        profilePhotoUrl: dto.profilePhotoUrl,
      },
    });

    await this.auditLog.log({
      userId: authUserId,
      action: 'student.contact_updated',
      entity: 'StudentProfile',
      entityId: updated.id,
      ipAddress: ip,
    });

    return updated;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  async assertOwnership(authUserId: string, studentId: string): Promise<void> {
    const s = await this.repo.findById(studentId);
    if (!s) throw new NotFoundException('Student not found');
    if (s.authUserId !== authUserId) {
      throw new ForbiddenException('You do not own this resource');
    }
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.repo.exists(id);
    if (!exists) throw new NotFoundException(`Student ${id} not found`);
  }

  /**
   * Generates a unique student number of the form STU-YYYY-NNNNNN.
   * Uses a sequential count per year. For very high concurrency, replace with
   * a DB sequence or a UUID-based scheme.
   */
  private async generateStudentNumber(admissionDate: string): Promise<string> {
    const year = new Date(admissionDate).getUTCFullYear();
    const prefix = `STU-${year}-`;
    const count = await this.repo.countByPrefix(prefix);
    const next = (count + 1).toString().padStart(6, '0');
    return `${prefix}${next}`;
  }
}
