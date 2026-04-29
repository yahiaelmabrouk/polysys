import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentsRepository } from './students.repository';
import { AttendanceModule } from '../attendance/attendance.module';
import { AcademicHistoryModule } from '../academic-history/academic-history.module';
import { NotesModule } from '../notes/notes.module';

@Module({
  imports: [AttendanceModule, AcademicHistoryModule, NotesModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentsRepository],
  exports: [StudentsService, StudentsRepository],
})
export class StudentsModule {}
