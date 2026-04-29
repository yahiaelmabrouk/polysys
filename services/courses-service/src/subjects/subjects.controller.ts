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
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  list(
    @Query('keyword') keyword: string | undefined,
    @Query('departmentId') departmentId: string | undefined,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive: boolean | undefined,
    @Query() pagination: PaginationDto,
  ) {
    return this.subjectsService.list(keyword, departmentId, isActive, pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.findById(id);
  }

  @Post()
  @Roles('Admin')
  create(
    @Body() dto: CreateSubjectDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.subjectsService.create(dto, user, ip);
  }

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.subjectsService.update(id, dto, user, ip);
  }
}
