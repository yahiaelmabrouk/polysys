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
import { GradesService } from './grades.service';
import {
  BulkCreateGradesDto,
  CreateGradeDto,
  OverrideGradeDto,
  UpdateGradeDto,
} from './dto/grade.dto';
import { GradeFilterDto } from './dto/grade-filter.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('grades')
export class GradesController {
  constructor(private readonly service: GradesService) {}

  // ─── Student self-service ──────────────────────────────────────────────

  @Get('me')
  @Roles('Student')
  myGrades(@CurrentUser() user: JwtPayload) {
    return this.service.myGrades(user);
  }

  @Get('me/term/:term')
  @Roles('Student')
  myGradesByTerm(
    @CurrentUser() user: JwtPayload,
    @Param('term') term: string,
  ) {
    return this.service.myGrades(user, term);
  }

  // ─── Admin search ──────────────────────────────────────────────────────

  @Get()
  @Roles('Admin')
  list(@Query() filters: GradeFilterDto) {
    return this.service.list(filters);
  }

  @Get(':id')
  @Roles('Student', 'Teacher', 'Admin')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findByIdForActor(id, user);
  }

  // ─── Teacher entry ────────────────────────────────────────────────────

  @Post()
  @Roles('Teacher', 'Admin')
  create(
    @Body() dto: CreateGradeDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.upsertGrade(dto, user, ip);
  }

  @Post('bulk')
  @Roles('Teacher', 'Admin')
  bulkCreate(
    @Body() dto: BulkCreateGradesDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.bulkUpsert(dto, user, ip);
  }

  @Patch(':id')
  @Roles('Teacher', 'Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.updateGrade(id, dto, user, ip);
  }

  @Patch(':id/override')
  @Roles('Admin')
  override(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideGradeDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.overrideGrade(id, dto, user, ip);
  }
}
