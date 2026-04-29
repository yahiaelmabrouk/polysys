import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3004', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  internalSecret: process.env.INTERNAL_SECRET,
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  studentsServiceUrl:
    process.env.STUDENTS_SERVICE_URL || 'http://localhost:3002',
  coursesServiceUrl:
    process.env.COURSES_SERVICE_URL || 'http://localhost:3003',
  gradesServiceUrl: process.env.GRADES_SERVICE_URL || 'http://localhost:3005',
  minFullTimeCredits: parseFloat(process.env.MIN_FULL_TIME_CREDITS || '12'),
  maxStandardCredits: parseFloat(process.env.MAX_STANDARD_CREDITS || '18'),
  maxOverloadCredits: parseFloat(process.env.MAX_OVERLOAD_CREDITS || '24'),
  waitlistReservationTtlHours: parseInt(
    process.env.WAITLIST_RESERVATION_TTL_HOURS || '48',
    10,
  ),
  enrollmentLockTtlSeconds: parseInt(
    process.env.ENROLLMENT_LOCK_TTL_SECONDS || '10',
    10,
  ),
  enablePrerequisiteCheck:
    (process.env.ENABLE_PREREQUISITE_CHECK || 'true').toLowerCase() === 'true',
  enableScheduleConflictCheck:
    (process.env.ENABLE_SCHEDULE_CONFLICT_CHECK || 'false').toLowerCase() ===
    'true',
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
