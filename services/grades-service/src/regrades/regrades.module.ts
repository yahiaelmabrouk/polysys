import { Module } from '@nestjs/common';
import { RegradesController } from './regrades.controller';
import { RegradesService } from './regrades.service';
import { RegradesRepository } from './regrades.repository';
import { GradesModule } from '../grades/grades.module';

@Module({
  imports: [GradesModule],
  controllers: [RegradesController],
  providers: [RegradesService, RegradesRepository],
  exports: [RegradesService, RegradesRepository],
})
export class RegradesModule {}
