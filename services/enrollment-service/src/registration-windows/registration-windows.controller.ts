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
import { RegistrationWindowsService } from './registration-windows.service';
import {
  CreateRegistrationWindowDto,
  UpdateRegistrationWindowDto,
} from './dto/registration-window.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('registration-windows')
export class RegistrationWindowsController {
  constructor(private readonly service: RegistrationWindowsService) {}

  @Get()
  list(
    @Query('term') term?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.list({
      academicTerm: term,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles('Admin')
  create(
    @Body() dto: CreateRegistrationWindowDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.create(dto, user, ip);
  }

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegistrationWindowDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.update(id, dto, user, ip);
  }
}
