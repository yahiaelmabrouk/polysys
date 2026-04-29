import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosInstance } from 'axios';
import { HttpClientFactory } from './http-client.factory';

export interface RemoteCompletedCourse {
  courseId: string;
  courseCode?: string;
  grade?: string;
  passed: boolean;
  academicTerm?: string;
}

@Injectable()
export class GradesClient {
  private readonly http: AxiosInstance;

  constructor(
    config: ConfigService,
    private readonly factory: HttpClientFactory,
  ) {
    this.http = factory.create(
      config.get<string>('app.gradesServiceUrl') || 'http://localhost:3005',
    );
  }

  /**
   * Returns the list of courses the student has completed (with grade if any).
   * Returns an empty list if the Grades Service is unreachable or returns 404,
   * so prerequisite checks degrade gracefully in dev environments.
   */
  async listCompletedCourses(
    studentId: string,
  ): Promise<RemoteCompletedCourse[]> {
    try {
      const result = await this.factory.getOrNull<RemoteCompletedCourse[]>(
        this.http,
        `/internal/students/${encodeURIComponent(studentId)}/completed-courses`,
      );
      return result ?? [];
    } catch {
      return [];
    }
  }
}
