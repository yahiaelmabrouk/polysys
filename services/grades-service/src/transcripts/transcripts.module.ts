import { Module } from '@nestjs/common';
import { TranscriptsController } from './transcripts.controller';
import { TranscriptsService } from './transcripts.service';
import { TranscriptsRepository } from './transcripts.repository';
import { ResultsModule } from '../results/results.module';
import { GpaModule } from '../gpa/gpa.module';

@Module({
  imports: [ResultsModule, GpaModule],
  controllers: [TranscriptsController],
  providers: [TranscriptsService, TranscriptsRepository],
  exports: [TranscriptsService, TranscriptsRepository],
})
export class TranscriptsModule {}
