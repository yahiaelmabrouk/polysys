import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  UpdateStudentStatusDto,
  UpdateOwnContactDto,
  StudentSearchDto,
} from './dto/student.dto';
import { AttendanceService } from '../attendance/attendance.service';
import { AcademicHistoryService } from '../academic-history/academic-history.service';
import { NotesService } from '../notes/notes.service';
import { CreateNoteDto } from '../notes/dto/note.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly attendanceService: AttendanceService,
    private readonly historyService: AcademicHistoryService,
    private readonly notesService: NotesService,
  ) {}

  // ─── Self-Service ───────────────────────────────────────────────────────

  @Get('me')
  @Roles('Student')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.studentsService.findByAuthUserId(user.sub);
  }

  @Patch('me/contact')
  @Roles('Student')
  async updateMyContact(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOwnContactDto,
    @ClientIp() ip: string,
  ) {
    return this.studentsService.updateOwnContact(user.sub, dto, ip);
  }

  @Get('me/attendance')
  @Roles('Student')
  async getMyAttendance(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ) {
    const student = await this.studentsService.findByAuthUserId(user.sub);
    return this.attendanceService.findForStudent(student.id, pagination);
  }

  @Get('me/history')
  @Roles('Student')
  async getMyHistory(@CurrentUser() user: JwtPayload) {
    const student = await this.studentsService.findByAuthUserId(user.sub);
    return this.historyService.findForStudent(student.id);
  }

  // ─── Admin / Staff ──────────────────────────────────────────────────────

  @Post()
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.studentsService.create(dto, user.sub, ip);
  }

  @Get()
  @Roles('Admin', 'Teacher', 'Finance Staff')
  list(@Query() filters: StudentSearchDto) {
    return this.studentsService.search(filters);
  }

  @Get(':id')
  @Roles('Admin', 'Teacher', 'Finance Staff')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findById(id);
  }

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.studentsService.update(id, dto, user.sub, ip);
  }

  @Patch(':id/status')
  @Roles('Admin')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentStatusDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.studentsService.updateStatus(id, dto, user.sub, ip);
  }

  @Get(':id/attendance')
  @Roles('Admin', 'Teacher')
  getAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.attendanceService.findForStudent(id, pagination);
  }

  @Get(':id/history')
  @Roles('Admin', 'Teacher', 'Finance Staff')
  getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.historyService.findForStudent(id);
  }

  @Post(':id/notes')
  @Roles('Admin', 'Teacher')
  @HttpCode(HttpStatus.CREATED)
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notesService.create(id, user.sub, dto);
  }
}
