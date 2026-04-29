import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3005', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  internalSecret: process.env.INTERNAL_SECRET,
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  studentsServiceUrl: process.env.STUDENTS_SERVICE_URL || 'http://localhost:3002',
  coursesServiceUrl: process.env.COURSES_SERVICE_URL || 'http://localhost:3003',
  enrollmentServiceUrl: process.env.ENROLLMENT_SERVICE_URL || 'http://localhost:3004',
  defaultPassPercentage: parseFloat(process.env.DEFAULT_PASS_PERCENTAGE || '50'),
  allowTeacherPublish:
    (process.env.ALLOW_TEACHER_PUBLISH || 'false').toLowerCase() === 'true',
  transcriptNumberPrefix: process.env.TRANSCRIPT_NUMBER_PREFIX || 'TR',
  resultPublishLockTtlSeconds: parseInt(
    process.env.RESULT_PUBLISH_LOCK_TTL_SECONDS || '30',
    10,
  ),
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const throttleConfig = registerAs('throttle', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT || '60', 10),
}));
