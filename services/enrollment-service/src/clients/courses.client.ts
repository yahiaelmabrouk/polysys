import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosInstance } from 'axios';
import { HttpClientFactory } from './http-client.factory';

export interface RemoteCourse {
  id: string;
  courseCode: string;
  title: string;
  credits: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | string;
  capacityDefault?: number | null;
  departmentId?: string;
  subjectId?: string;
}

export interface RemoteCoursePrerequisite {
  prerequisiteCourseId: string;
  prerequisiteCourseCode?: string;
  type: 'REQUIRED' | 'RECOMMENDED' | 'COREQUISITE';
  minGrade?: string | null;
}

export interface RemoteEligibilityRules {
  course: { id: string; status: string; credits: number };
  prerequisites: RemoteCoursePrerequisite[];
}

@Injectable()
export class CoursesClient {
  private readonly http: AxiosInstance;

  constructor(
    config: ConfigService,
    private readonly factory: HttpClientFactory,
  ) {
    this.http = factory.create(
      config.get<string>('app.coursesServiceUrl') || 'http://localhost:3003',
    );
  }

  findById(courseId: string): Promise<RemoteCourse | null> {
    return this.factory.getOrNull<RemoteCourse>(
      this.http,
      `/internal/courses/${encodeURIComponent(courseId)}`,
    );
  }

  getEligibilityRules(
    courseId: string,
  ): Promise<RemoteEligibilityRules | null> {
    return this.factory.getOrNull<RemoteEligibilityRules>(
      this.http,
      `/internal/courses/${encodeURIComponent(courseId)}/eligibility-rules`,
    );
  }
}
