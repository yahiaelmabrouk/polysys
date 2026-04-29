import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosInstance } from 'axios';
import { HttpClientFactory } from './http-client.factory';

export interface RemoteStudent {
  id: string;
  authUserId?: string;
  status: string;
  fullName?: string;
  email?: string;
  classification?: string;
  academicStanding?: string;
  programName?: string;
  enrollmentYear?: number;
}

@Injectable()
export class StudentsClient {
  private readonly http: AxiosInstance;

  constructor(
    config: ConfigService,
    private readonly factory: HttpClientFactory,
  ) {
    this.http = factory.create(
      config.get<string>('app.studentsServiceUrl') ||
        'http://localhost:3002',
    );
  }

  findById(studentId: string): Promise<RemoteStudent | null> {
    return this.factory.getOrNull<RemoteStudent>(
      this.http,
      `/internal/students/${encodeURIComponent(studentId)}`,
    );
  }
}
