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
import { AttendanceService } from './attendance.service';
import {
  CreateAttendanceDto,
  BulkAttendanceDto,
  UpdateAttendanceDto,
} from './dto/attendance.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @Roles('Admin', 'Teacher')
  mark(
    @Body() dto: CreateAttendanceDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.attendanceService.mark(dto, user, ip);
  }

  @Post('bulk')
  @Roles('Admin', 'Teacher')
  markBulk(
    @Body() dto: BulkAttendanceDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.attendanceService.markBulk(dto, user, ip);
  }

  @Get('course/:courseId')
  @Roles('Admin', 'Teacher')
  byCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query('sessionDate') sessionDate: string | undefined,
    @Query() pagination: PaginationDto,
  ) {
    return this.attendanceService.findForCourse(courseId, sessionDate, pagination);
  }

  @Patch(':id')
  @Roles('Admin', 'Teacher')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.attendanceService.update(id, dto, user, ip);
  }
}
