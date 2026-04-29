import { Global, Module } from '@nestjs/common';
import { HttpClientFactory } from './http-client.factory';
import { StudentsClient } from './students.client';
import { CoursesClient } from './courses.client';
import { GradesClient } from './grades.client';

@Global()
@Module({
  providers: [HttpClientFactory, StudentsClient, CoursesClient, GradesClient],
  exports: [StudentsClient, CoursesClient, GradesClient, HttpClientFactory],
})
export class ClientsModule {}
