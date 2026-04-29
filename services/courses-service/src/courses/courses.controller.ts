import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { PrerequisitesService } from '../prerequisites/prerequisites.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  UpdateCourseStatusDto,
} from './dto/course.dto';
import { CourseFilterDto } from './dto/course-filter.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  AddPrerequisiteDto,
} from '../prerequisites/dto/prerequisite.dto';
import { TeacherAssignmentsService } from '../teacher-assignments/teacher-assignments.service';
import { AssignTeacherDto } from '../teacher-assignments/dto/teacher-assignment.dto';

@Controller()
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly prerequisitesService: PrerequisitesService,
    private readonly assignmentsService: TeacherAssignmentsService,
  ) {}

  // ─── Public Read (any authenticated user) ───────────────────────────────

  @Get('courses')
  list(@Query() filters: CourseFilterDto) {
    return this.coursesService.list(filters);
  }

  @Get('courses/code/:courseCode')
  byCode(@Param('courseCode') courseCode: string) {
    return this.coursesService.findByCode(courseCode);
  }

  @Get('courses/:id/prerequisites')
  getPrerequisites(@Param('id', ParseUUIDPipe) id: string) {
    return this.prerequisitesService.listForCourse(id);
  }

  @Get('teachers/me/courses')
  @Roles('Teacher', 'Admin')
  myCourses(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ) {
    return this.coursesService.findCoursesForTeacher(
      user.sub,
      pagination.page ?? 1,
      pagination.limit ?? 20,
    );
  }

  @Get('courses/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findById(id);
  }

  // ─── Admin Management ───────────────────────────────────────────────────

  @Post('courses')
  @Roles('Admin')
  create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.coursesService.create(dto, user, ip);
  }

  @Patch('courses/:id')
  @Roles('Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.coursesService.update(id, dto, user, ip);
  }

  @Patch('courses/:id/status')
  @Roles('Admin')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseStatusDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.coursesService.changeStatus(id, dto, user, ip);
  }

  @Delete('courses/:id')
  @Roles('Admin')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.coursesService.remove(id, user, ip);
  }

  // ─── Prerequisites under /courses/:id ──────────────────────────────────

  @Post('courses/:id/prerequisites')
  @Roles('Admin')
  addPrerequisite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPrerequisiteDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    if (id === dto.prerequisiteCourseId) {
      throw new BadRequestException('A course cannot be its own prerequisite');
    }
    return this.prerequisitesService.add(id, dto, user, ip);
  }

  @Delete('courses/:id/prerequisites/:prerequisiteId')
  @Roles('Admin')
  removePrerequisite(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prerequisiteId', ParseUUIDPipe) prerequisiteId: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.prerequisitesService.remove(id, prerequisiteId, user, ip);
  }

  // ─── Teacher assignment shortcut under /courses/:id ────────────────────

  @Post('courses/:id/assign-teacher')
  @Roles('Admin')
  assignTeacher(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTeacherDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    if (dto.courseId && dto.courseId !== id) {
      throw new ForbiddenException('Body courseId does not match URL');
    }
    return this.assignmentsService.assign({ ...dto, courseId: id }, user, ip);
  }
}
