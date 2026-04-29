import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  internalSecret: process.env.INTERNAL_SECRET,
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  attendanceLockDays: parseInt(process.env.ATTENDANCE_LOCK_DAYS || '7', 10),
  lowAttendanceThreshold: parseInt(process.env.LOW_ATTENDANCE_THRESHOLD || '75', 10),
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
