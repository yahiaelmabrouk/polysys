import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { InternalGuard } from '../guards/internal.guard';
import { ResultsService } from '../results/results.service';
import { GpaService } from '../gpa/gpa.service';
import { TranscriptsService } from '../transcripts/transcripts.service';

@Public()
@UseGuards(InternalGuard)
@Controller('internal')
export class InternalController {
  constructor(
    private readonly results: ResultsService,
    private readonly gpa: GpaService,
    private readonly transcripts: TranscriptsService,
  ) {}

  @Get('students/:studentId/completed-courses')
  completedCourses(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.results.findCompletedByStudent(studentId);
  }

  @Get('students/:studentId/gpa')
  studentGpa(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.gpa.getLatest(studentId);
  }

  @Get('courses/:courseId/results')
  courseResults(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('term') term: string,
  ) {
    return this.results.findByCourseTerm(courseId, term);
  }

  @Get('students/:studentId/transcript-summary')
  transcriptSummary(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.transcripts.getLatestSnapshot(studentId);
  }
}
