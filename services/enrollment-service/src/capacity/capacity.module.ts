import { Module } from '@nestjs/common';
import { CapacityController } from './capacity.controller';
import { CapacityService } from './capacity.service';
import { CapacityRepository } from './capacity.repository';

@Module({
  controllers: [CapacityController],
  providers: [CapacityService, CapacityRepository],
  exports: [CapacityService, CapacityRepository],
})
export class CapacityModule {}
