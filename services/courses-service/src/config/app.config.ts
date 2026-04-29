import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3003', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  internalSecret: process.env.INTERNAL_SECRET,
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  minCourseCredits: parseFloat(process.env.MIN_COURSE_CREDITS || '1'),
  maxCourseCredits: parseFloat(process.env.MAX_COURSE_CREDITS || '10'),
  allowDecimalCredits:
    (process.env.ALLOW_DECIMAL_CREDITS || 'false').toLowerCase() === 'true',
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
