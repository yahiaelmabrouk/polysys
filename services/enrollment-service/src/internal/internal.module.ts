import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CapacityModule } from '../capacity/capacity.module';
import { RosterModule } from '../roster/roster.module';

@Module({
  imports: [EnrollmentsModule, CapacityModule, RosterModule],
  controllers: [InternalController],
})
export class InternalModule {}
