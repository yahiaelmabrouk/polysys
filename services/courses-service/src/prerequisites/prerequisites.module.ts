import { Module } from '@nestjs/common';
import { PrerequisitesService } from './prerequisites.service';
import { PrerequisitesRepository } from './prerequisites.repository';

// Note: routes for prerequisites are mounted under the CoursesController
// (POST/DELETE /courses/:id/prerequisites). This module exposes the service
// and repository for cross-module use.
@Module({
  providers: [PrerequisitesService, PrerequisitesRepository],
  exports: [PrerequisitesService, PrerequisitesRepository],
})
export class PrerequisitesModule {}
