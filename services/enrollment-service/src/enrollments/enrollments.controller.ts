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
import { EnrollmentsService } from './enrollments.service';
import {
  BulkCreateEnrollmentDto,
  CreateEnrollmentDto,
  DropEnrollmentDto,
  ForceDropDto,
  ForceEnrollDto,
  UpdateEnrollmentStatusDto,
} from './dto/enrollment.dto';
import { EnrollmentFilterDto } from './dto/enrollment-filter.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller()
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  // ─── Student self-service ──────────────────────────────────────────────

  @Get('enrollments/me')
  @Roles('Student', 'Admin')
  myEnrollments(
    @CurrentUser() user: JwtPayload,
    @Query('term') term?: string,
  ) {
    return this.service.listForStudent(user.sub, term);
  }

  @Get('enrollments/me/current')
  @Roles('Student', 'Admin')
  myCurrent(
    @CurrentUser() user: JwtPayload,
    @Query('term') term: string,
  ) {
    return this.service.listForStudent(user.sub, term);
  }

  @Post('enrollments')
  @Roles('Student', 'Admin')
  enroll(
    @Body() dto: CreateEnrollmentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.createSelfService(user.sub, dto, user, ip);
  }

  @Post('enrollments/bulk')
  @Roles('Student', 'Admin')
  enrollBulk(
    @Body() dto: BulkCreateEnrollmentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.createBulkSelfService(user.sub, dto, user, ip);
  }

  @Delete('enrollments/:id/drop')
  @Roles('Student', 'Admin')
  drop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DropEnrollmentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.dropById(id, dto, user, ip);
  }

  // ─── Admin ─────────────────────────────────────────────────────────────

  @Get('enrollments')
  @Roles('Admin')
  list(@Query() filters: EnrollmentFilterDto) {
    return this.service.list(filters);
  }

  @Get('enrollments/:id')
  @Roles('Admin')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id, true);
  }

  @Patch('enrollments/:id/status')
  @Roles('Admin')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentStatusDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.updateStatus(id, dto, user, ip);
  }

  @Post('admin/force-enroll')
  @Roles('Admin')
  forceEnroll(
    @Body() dto: ForceEnrollDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.forceEnroll(dto, user, ip);
  }

  @Post('admin/force-drop')
  @Roles('Admin')
  forceDrop(
    @Body() dto: ForceDropDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.forceDrop(dto, user, ip);
  }
}
