import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3004),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  CLIENT_URL: Joi.string().default('http://localhost:3000'),
  INTERNAL_SECRET: Joi.string().required(),
  AUTH_SERVICE_URL: Joi.string().uri().default('http://localhost:3001'),
  STUDENTS_SERVICE_URL: Joi.string().uri().default('http://localhost:3002'),
  COURSES_SERVICE_URL: Joi.string().uri().default('http://localhost:3003'),
  GRADES_SERVICE_URL: Joi.string().uri().default('http://localhost:3005'),
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(60),
  MIN_FULL_TIME_CREDITS: Joi.number().min(0).default(12),
  MAX_STANDARD_CREDITS: Joi.number().min(1).default(18),
  MAX_OVERLOAD_CREDITS: Joi.number().min(1).default(24),
  WAITLIST_RESERVATION_TTL_HOURS: Joi.number().min(1).default(48),
  ENROLLMENT_LOCK_TTL_SECONDS: Joi.number().min(1).default(10),
  ENABLE_PREREQUISITE_CHECK: Joi.string()
    .valid('true', 'false')
    .default('true'),
  ENABLE_SCHEDULE_CONFLICT_CHECK: Joi.string()
    .valid('true', 'false')
    .default('false'),
});
