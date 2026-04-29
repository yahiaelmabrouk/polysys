import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AcademicHistoryService } from './academic-history.service';
import { RecordAcademicHistoryDto } from './dto/academic-history.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('academic-history')
export class AcademicHistoryController {
  constructor(private readonly historyService: AcademicHistoryService) {}

  @Get(':studentId')
  @Roles('Admin', 'Teacher', 'Finance Staff')
  list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.historyService.findForStudent(studentId);
  }

  // Admin manual entry; the canonical path is via grades.semester_closed events.
  @Post(':studentId')
  @Roles('Admin')
  record(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: RecordAcademicHistoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.historyService.record(studentId, dto, user.sub);
  }
}
