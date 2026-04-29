import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CoursesRepository } from './courses.repository';
import { DepartmentsModule } from '../departments/departments.module';
import { SubjectsModule } from '../subjects/subjects.module';
import { PrerequisitesModule } from '../prerequisites/prerequisites.module';
import { TeacherAssignmentsModule } from '../teacher-assignments/teacher-assignments.module';

@Module({
  imports: [
    DepartmentsModule,
    SubjectsModule,
    PrerequisitesModule,
    TeacherAssignmentsModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesRepository],
  exports: [CoursesService, CoursesRepository],
})
export class CoursesModule {}
