import { Module } from '@nestjs/common';
import { AcademicHistoryController } from './academic-history.controller';
import { AcademicHistoryService } from './academic-history.service';

@Module({
  controllers: [AcademicHistoryController],
  providers: [AcademicHistoryService],
  exports: [AcademicHistoryService],
})
export class AcademicHistoryModule {}
