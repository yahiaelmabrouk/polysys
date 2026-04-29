import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InternalGuard } from '../guards/internal.guard';
import { Public } from '../common/decorators/public.decorator';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { CapacityService } from '../capacity/capacity.service';
import { RosterService } from '../roster/roster.service';

/**
 * Internal-only routes for cross-service consumption.
 *
 * Authentication: shared INTERNAL_SECRET via x-internal-secret header.
 * These routes bypass JWT auth (marked @Public to skip the global JwtAuthGuard)
 * and are protected exclusively by the InternalGuard.
 *
 * Consumers:
 *   - Grades  : roster ingestion at end-of-term
 *   - Finance : enrollment ingestion for tuition generation
 *   - Scheduling : roster lookup for room assignment
 *   - AI Agent : load + bottleneck analytics
 */
@Controller('internal')
@Public()
@UseGuards(InternalGuard)
export class InternalController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly capacity: CapacityService,
    private readonly roster: RosterService,
  ) {}

  @Get('students/:studentId/current-load')
  async currentLoad(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query('term') term: string,
  ) {
    if (!term) throw new BadRequestException('term is required');
    const credits = await this.enrollments.currentLoad(studentId, term);
    return { studentId, academicTerm: term, credits };
  }

  @Get('students/:studentId/enrollments')
  studentEnrollments(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query('term') term?: string,
  ) {
    return this.enrollments.listForStudent(studentId, term);
  }

  @Get('courses/:courseId/seat-status')
  seatStatus(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('term') term: string,
  ) {
    if (!term) throw new BadRequestException('term is required');
    return this.capacity.getSeatStatus(courseId, term);
  }

  @Get('courses/:courseId/roster')
  rosterInternal(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('term') term: string,
    @Query('section') section?: string,
  ) {
    if (!term) throw new BadRequestException('term is required');
    return this.roster.getRoster(courseId, term, section);
  }
}
