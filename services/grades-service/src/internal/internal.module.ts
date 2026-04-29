import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { ResultsModule } from '../results/results.module';
import { GpaModule } from '../gpa/gpa.module';
import { TranscriptsModule } from '../transcripts/transcripts.module';

@Module({
  imports: [ResultsModule, GpaModule, TranscriptsModule],
  controllers: [InternalController],
})
export class InternalModule {}
