import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { WaitlistsService } from './waitlists.service';
import { JoinWaitlistDto } from './dto/waitlist.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('waitlists')
export class WaitlistsController {
  constructor(private readonly service: WaitlistsService) {}

  @Get('me')
  @Roles('Student', 'Admin')
  myWaitlists(@CurrentUser() user: JwtPayload) {
    return this.service.listForStudent(user.sub);
  }

  @Post(':courseId/join')
  @Roles('Student', 'Admin')
  join(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: JoinWaitlistDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.join(courseId, user.sub, dto, user, ip);
  }

  @Delete(':id/leave')
  @Roles('Student', 'Admin')
  leave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.leave(id, user, ip);
  }
}
