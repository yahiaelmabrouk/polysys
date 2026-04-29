import { Module } from '@nestjs/common';
import { RegistrationWindowsController } from './registration-windows.controller';
import { RegistrationWindowsService } from './registration-windows.service';
import { RegistrationWindowsRepository } from './registration-windows.repository';

@Module({
  controllers: [RegistrationWindowsController],
  providers: [RegistrationWindowsService, RegistrationWindowsRepository],
  exports: [RegistrationWindowsService],
})
export class RegistrationWindowsModule {}
