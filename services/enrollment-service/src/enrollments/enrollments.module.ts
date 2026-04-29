import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsRepository } from './enrollments.repository';
import { CapacityModule } from '../capacity/capacity.module';
import { WaitlistsModule } from '../waitlists/waitlists.module';
import { RegistrationWindowsModule } from '../registration-windows/registration-windows.module';

@Module({
  imports: [CapacityModule, WaitlistsModule, RegistrationWindowsModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EnrollmentsRepository],
  exports: [EnrollmentsService, EnrollmentsRepository],
})
export class EnrollmentsModule {}
