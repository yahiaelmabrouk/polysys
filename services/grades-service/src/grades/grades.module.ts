import { Module } from '@nestjs/common';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';
import { GradesRepository } from './grades.repository';
import { AssessmentsModule } from '../assessments/assessments.module';
import { GradingScalesModule } from '../grading-scales/grading-scales.module';

@Module({
  imports: [AssessmentsModule, GradingScalesModule],
  controllers: [GradesController],
  providers: [GradesService, GradesRepository],
  exports: [GradesService, GradesRepository],
})
export class GradesModule {}
