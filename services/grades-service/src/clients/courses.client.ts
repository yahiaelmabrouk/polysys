import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosInstance } from 'axios';
import { HttpClientFactory } from './http-client.factory';

export interface RemoteCourse {
  id: string;
  courseCode: string;
  title: string;
  credits: number;
  status: string;
  capacityDefault?: number | null;
  departmentId?: string;
  subjectId?: string;
}

export interface RemoteTeacherAssignment {
  id: string;
  courseId: string;
  teacherUserId: string;
  academicTerm: string;
  sectionCode: string;
  status: string;
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

  async listTeacherCourses(
    teacherUserId: string,
  ): Promise<RemoteTeacherAssignment[]> {
    const result = await this.factory.getOrNull<RemoteTeacherAssignment[]>(
      this.http,
      `/internal/teachers/${encodeURIComponent(teacherUserId)}/courses`,
    );
    return result ?? [];
  }

  async isTeacherAssignedToCourse(
    teacherUserId: string,
    courseId: string,
    academicTerm?: string,
    sectionCode?: string,
  ): Promise<boolean> {
    const assignments = await this.listTeacherCourses(teacherUserId);
    return assignments.some(
      (a) =>
        a.courseId === courseId &&
        a.status === 'ACTIVE' &&
        (!academicTerm || a.academicTerm === academicTerm) &&
        (!sectionCode || a.sectionCode === sectionCode),
    );
  }
}
