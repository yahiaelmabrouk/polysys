import { Module } from '@nestjs/common';
import { GradingScalesController } from './grading-scales.controller';
import { GradingScalesService } from './grading-scales.service';
import { GradingScalesRepository } from './grading-scales.repository';

@Module({
  controllers: [GradingScalesController],
  providers: [GradingScalesService, GradingScalesRepository],
  exports: [GradingScalesService, GradingScalesRepository],
})
export class GradingScalesModule {}
