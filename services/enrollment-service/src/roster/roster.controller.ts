import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { RosterService } from './roster.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('courses')
export class RosterController {
  constructor(private readonly service: RosterService) {}

  @Get(':courseId/roster')
  @Roles('Teacher', 'Admin')
  roster(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('term') term: string,
    @Query('section') section?: string,
  ) {
    if (!term) throw new BadRequestException('term is required');
    return this.service.getRoster(courseId, term, section);
  }

  @Get(':courseId/waitlist')
  @Roles('Teacher', 'Admin')
  waitlist(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('term') term: string,
    @Query('section') section?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    if (!term) throw new BadRequestException('term is required');
    return this.service.getWaitlist(
      courseId,
      term,
      section,
      Number(page),
      Number(limit),
    );
  }
}
