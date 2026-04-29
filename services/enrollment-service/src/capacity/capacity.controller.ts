import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CapacityService } from './capacity.service';
import { UpsertCapacityDto } from './dto/capacity.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller()
export class CapacityController {
  constructor(private readonly service: CapacityService) {}

  @Get('capacity/:courseId')
  getStatus(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('term') term: string,
  ) {
    return this.service.getSeatStatus(courseId, term);
  }

  @Patch('capacity/:courseId')
  @Roles('Admin')
  upsert(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: UpsertCapacityDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.upsertCapacity(courseId, dto, user, ip);
  }
}
