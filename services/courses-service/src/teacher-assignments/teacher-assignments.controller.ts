import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { UpdateTeacherAssignmentDto } from './dto/teacher-assignment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('teacher-assignments')
export class TeacherAssignmentsController {
  constructor(private readonly assignmentsService: TeacherAssignmentsService) {}

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherAssignmentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.assignmentsService.update(id, dto, user, ip);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.assignmentsService.remove(id, user, ip);
  }
}
