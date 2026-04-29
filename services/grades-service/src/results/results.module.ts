import { Module } from '@nestjs/common';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { ResultsRepository } from './results.repository';
import { GradesModule } from '../grades/grades.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { GradingScalesModule } from '../grading-scales/grading-scales.module';

@Module({
  imports: [GradesModule, AssessmentsModule, GradingScalesModule],
  controllers: [ResultsController],
  providers: [ResultsService, ResultsRepository],
  exports: [ResultsService, ResultsRepository],
})
export class ResultsModule {}
