import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalGuard } from '../guards/internal.guard';
import { Public } from '../common/decorators/public.decorator';
import { StudentsService } from '../students/students.service';
import { AcademicHistoryService } from '../academic-history/academic-history.service';
import { RecordAcademicHistoryDto } from '../academic-history/dto/academic-history.dto';

/**
 * Internal-only routes for cross-service consumption.
 *
 * Authentication: shared INTERNAL_SECRET via x-internal-secret header.
 * These routes bypass JWT auth (marked @Public to skip the global JwtAuthGuard)
 * and are protected exclusively by the InternalGuard.
 *
 * Consumers: Enrollment, Grades, Finance, Notification, AI Agent.
 */
@Controller('internal')
@Public()
@UseGuards(InternalGuard)
export class InternalController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly historyService: AcademicHistoryService,
  ) {}

  @Get('students/:id')
  getStudent(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findById(id);
  }

  @Get('by-auth-user/:authUserId')
  getByAuthUser(@Param('authUserId', ParseUUIDPipe) authUserId: string) {
    return this.studentsService.findByAuthUserId(authUserId);
  }

  @Get('student-number/:studentNumber')
  getByStudentNumber(@Param('studentNumber') studentNumber: string) {
    return this.studentsService.findByStudentNumber(studentNumber);
  }

  @Get('students/:id/status')
  getStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.getStatus(id);
  }

  // Snapshot push endpoint used by Grades Service when not using events.
  @Post('students/:id/academic-history')
  pushAcademicHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordAcademicHistoryDto,
  ) {
    return this.historyService.record(id, dto);
  }
}
