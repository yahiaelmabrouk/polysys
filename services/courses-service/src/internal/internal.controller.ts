import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { InternalGuard } from '../guards/internal.guard';
import { Public } from '../common/decorators/public.decorator';
import { CoursesService } from '../courses/courses.service';
import { DepartmentsService } from '../departments/departments.service';
import { TeacherAssignmentsService } from '../teacher-assignments/teacher-assignments.service';

/**
 * Internal-only routes for cross-service consumption.
 *
 * Authentication: shared INTERNAL_SECRET via x-internal-secret header.
 * These routes bypass JWT auth (marked @Public to skip the global JwtAuthGuard)
 * and are protected exclusively by the InternalGuard.
 *
 * Consumers: Enrollment, Scheduling, Grades, Finance, Notification, AI Agent.
 */
@Controller('internal')
@Public()
@UseGuards(InternalGuard)
export class InternalController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly departmentsService: DepartmentsService,
    private readonly assignmentsService: TeacherAssignmentsService,
  ) {}

  @Get('courses/:id')
  getCourse(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findById(id);
  }

  @Get('courses/code/:courseCode')
  getCourseByCode(@Param('courseCode') courseCode: string) {
    return this.coursesService.findByCode(courseCode);
  }

  @Get('courses/:id/eligibility-rules')
  async getEligibility(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.coursesService.getEligibilityRules(id);
    if (!result) throw new NotFoundException('Course not found');
    return result;
  }

  @Get('teachers/:teacherId/courses')
  getTeacherCourses(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    return this.assignmentsService.listForTeacher(teacherId);
  }

  @Get('departments/:id')
  getDepartment(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findById(id);
  }
}
