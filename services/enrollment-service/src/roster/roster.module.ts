import { Module } from '@nestjs/common';
import { RosterController } from './roster.controller';
import { RosterService } from './roster.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { WaitlistsModule } from '../waitlists/waitlists.module';

@Module({
  imports: [EnrollmentsModule, WaitlistsModule],
  controllers: [RosterController],
  providers: [RosterService],
  exports: [RosterService],
})
export class RosterModule {}
