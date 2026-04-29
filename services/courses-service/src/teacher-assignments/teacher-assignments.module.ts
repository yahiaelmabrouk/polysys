import { Module } from '@nestjs/common';
import { TeacherAssignmentsController } from './teacher-assignments.controller';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { TeacherAssignmentsRepository } from './teacher-assignments.repository';

@Module({
  controllers: [TeacherAssignmentsController],
  providers: [TeacherAssignmentsService, TeacherAssignmentsRepository],
  exports: [TeacherAssignmentsService, TeacherAssignmentsRepository],
})
export class TeacherAssignmentsModule {}
