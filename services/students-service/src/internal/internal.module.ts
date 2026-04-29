import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { StudentsModule } from '../students/students.module';
import { AcademicHistoryModule } from '../academic-history/academic-history.module';

@Module({
  imports: [StudentsModule, AcademicHistoryModule],
  controllers: [InternalController],
})
export class InternalModule {}
