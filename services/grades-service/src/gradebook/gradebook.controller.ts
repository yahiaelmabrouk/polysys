import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { GradebookService } from './gradebook.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('courses')
export class GradebookController {
  constructor(private readonly service: GradebookService) {}

  @Get(':courseId/gradebook')
  @Roles('Teacher', 'Admin')
  getGradebook(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('term') term: string,
    @Query('section') section: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getGradebook(courseId, term, section, user);
  }
}
