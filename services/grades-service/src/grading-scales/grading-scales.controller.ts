import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GradingScalesService } from './grading-scales.service';
import {
  CreateGradingScaleDto,
  UpdateGradingScaleDto,
} from './dto/grading-scale.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('grading-scales')
export class GradingScalesController {
  constructor(private readonly service: GradingScalesService) {}

  @Get()
  list(@Query('name') name?: string) {
    return this.service.list(name);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles('Admin')
  create(
    @Body() dto: CreateGradingScaleDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.create(dto, user, ip);
  }

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradingScaleDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.update(id, dto, user, ip);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.remove(id, user, ip);
  }
}
