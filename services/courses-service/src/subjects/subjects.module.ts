import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
import { SubjectsRepository } from './subjects.repository';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [DepartmentsModule],
  controllers: [SubjectsController],
  providers: [SubjectsService, SubjectsRepository],
  exports: [SubjectsService, SubjectsRepository],
})
export class SubjectsModule {}
