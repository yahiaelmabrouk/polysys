import { Module } from '@nestjs/common';
import { GpaController } from './gpa.controller';
import { GpaService } from './gpa.service';
import { GpaRepository } from './gpa.repository';
import { ResultsModule } from '../results/results.module';

@Module({
  imports: [ResultsModule],
  controllers: [GpaController],
  providers: [GpaService, GpaRepository],
  exports: [GpaService, GpaRepository],
})
export class GpaModule {}
