import { Global, Module } from '@nestjs/common';
import { HttpClientFactory } from './http-client.factory';
import { CoursesClient } from './courses.client';
import { EnrollmentClient } from './enrollment.client';
import { StudentsClient } from './students.client';

@Global()
@Module({
  providers: [
    HttpClientFactory,
    CoursesClient,
    EnrollmentClient,
    StudentsClient,
  ],
  exports: [CoursesClient, EnrollmentClient, StudentsClient, HttpClientFactory],
})
export class ClientsModule {}
