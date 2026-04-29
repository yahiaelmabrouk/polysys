import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  // ─── Public Read (any authenticated user) ───────────────────────────────
  @Get()
  list(
    @Query('keyword') keyword: string | undefined,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive: boolean | undefined,
    @Query() pagination: PaginationDto,
  ) {
    return this.departmentsService.list(keyword, isActive, pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentsService.findById(id);
  }

  // ─── Admin Management ───────────────────────────────────────────────────
  @Post()
  @Roles('Admin')
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.departmentsService.create(dto, user, ip);
  }

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.departmentsService.update(id, dto, user, ip);
  }
}
