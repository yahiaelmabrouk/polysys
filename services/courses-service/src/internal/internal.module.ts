import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { CoursesModule } from '../courses/courses.module';
import { DepartmentsModule } from '../departments/departments.module';
import { TeacherAssignmentsModule } from '../teacher-assignments/teacher-assignments.module';

@Module({
  imports: [CoursesModule, DepartmentsModule, TeacherAssignmentsModule],
  controllers: [InternalController],
})
export class InternalModule {}
