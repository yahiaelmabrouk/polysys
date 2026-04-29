import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { GpaService } from './gpa.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { requireStudentId } from '../common/utils/actor.util';

@Controller('gpa')
export class GpaController {
  constructor(private readonly service: GpaService) {}

  @Get('me')
  @Roles('Student')
  myGpa(@CurrentUser() user: JwtPayload) {
    const studentId = requireStudentId(user);
    return this.service.getStudentSnapshots(studentId);
  }

  @Post('recalculate/:studentId')
  @Roles('Admin')
  recalculate(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.recalculateForStudent(studentId, user, ip);
  }
}
