import { Module } from '@nestjs/common';
import { GradebookController } from './gradebook.controller';
import { GradebookService } from './gradebook.service';
import { AssessmentsModule } from '../assessments/assessments.module';
import { GradesModule } from '../grades/grades.module';

@Module({
  imports: [AssessmentsModule, GradesModule],
  controllers: [GradebookController],
  providers: [GradebookService],
  exports: [GradebookService],
})
export class GradebookModule {}
