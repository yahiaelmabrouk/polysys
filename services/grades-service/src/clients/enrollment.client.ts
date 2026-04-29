import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosInstance } from 'axios';
import { HttpClientFactory } from './http-client.factory';

export interface RemoteEnrollment {
  id: string;
  studentId: string;
  courseId: string;
  academicTerm: string;
  sectionCode?: string | null;
  status:
    | 'PENDING'
    | 'ENROLLED'
    | 'WAITLISTED'
    | 'DROPPED'
    | 'WITHDRAWN'
    | 'COMPLETED'
    | 'FAILED'
    | string;
  creditsSnapshot: number;
  gradingOption?: string;
}

@Injectable()
export class EnrollmentClient {
  private readonly http: AxiosInstance;

  constructor(
    config: ConfigService,
    private readonly factory: HttpClientFactory,
  ) {
    this.http = factory.create(
      config.get<string>('app.enrollmentServiceUrl') ||
        'http://localhost:3004',
    );
  }

  async getRoster(
    courseId: string,
    academicTerm: string,
    sectionCode?: string,
  ): Promise<RemoteEnrollment[]> {
    const qs = new URLSearchParams({ term: academicTerm });
    if (sectionCode) qs.set('section', sectionCode);
    const result = await this.factory.getOrNull<RemoteEnrollment[]>(
      this.http,
      `/internal/courses/${encodeURIComponent(courseId)}/roster?${qs.toString()}`,
    );
    return result ?? [];
  }

  async findEnrollment(
    studentId: string,
    courseId: string,
    academicTerm: string,
  ): Promise<RemoteEnrollment | null> {
    return this.factory.getOrNull<RemoteEnrollment>(
      this.http,
      `/internal/enrollments/lookup?studentId=${encodeURIComponent(
        studentId,
      )}&courseId=${encodeURIComponent(courseId)}&term=${encodeURIComponent(
        academicTerm,
      )}`,
    );
  }

  async listStudentEnrollments(
    studentId: string,
    academicTerm?: string,
  ): Promise<RemoteEnrollment[]> {
    const url = `/internal/students/${encodeURIComponent(studentId)}/enrollments` +
      (academicTerm ? `?term=${encodeURIComponent(academicTerm)}` : '');
    const result = await this.factory.getOrNull<RemoteEnrollment[]>(
      this.http,
      url,
    );
    return result ?? [];
  }

  /**
   * Returns true if the student has an active enrollment in the given course/term
   * (status ENROLLED). Returns false on missing or non-active records.
   */
  async isActivelyEnrolled(
    studentId: string,
    courseId: string,
    academicTerm: string,
  ): Promise<boolean> {
    const enr = await this.findEnrollment(studentId, courseId, academicTerm);
    return !!enr && enr.status === 'ENROLLED';
  }
}
