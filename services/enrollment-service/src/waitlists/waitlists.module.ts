import { Module } from '@nestjs/common';
import { WaitlistsController } from './waitlists.controller';
import { WaitlistsService } from './waitlists.service';
import { WaitlistsRepository } from './waitlists.repository';
import { CapacityModule } from '../capacity/capacity.module';

@Module({
  imports: [CapacityModule],
  controllers: [WaitlistsController],
  providers: [WaitlistsService, WaitlistsRepository],
  exports: [WaitlistsService, WaitlistsRepository],
})
export class WaitlistsModule {}
