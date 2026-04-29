import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RegradesService } from './regrades.service';
import {
  CreateRegradeRequestDto,
  RegradeListDto,
  ReviewRegradeDto,
} from './dto/regrade.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('regrades')
export class RegradesController {
  constructor(private readonly service: RegradesService) {}

  @Post(':gradeId/request')
  @Roles('Student')
  request(
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
    @Body() dto: CreateRegradeRequestDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.request(gradeId, dto, user, ip);
  }

  @Patch(':id/review')
  @Roles('Teacher', 'Admin')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRegradeDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.review(id, dto, user, ip);
  }

  @Get()
  @Roles('Teacher', 'Admin')
  list(@Query() filters: RegradeListDto) {
    return this.service.list(filters);
  }
}
