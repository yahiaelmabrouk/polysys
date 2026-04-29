import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller()
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  // Teacher / Admin publish a course/term
  @Post('courses/:courseId/publish-results')
  @Roles('Teacher', 'Admin')
  publishCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('term') term: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.publishCourseTerm(courseId, term, user, ip);
  }

  // Admin publish whole term
  @Post('results/publish-term/:term')
  @Roles('Admin')
  publishTerm(
    @Param('term') term: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.publishTerm(term, user, ip);
  }
}
