import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3005),
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
  ENROLLMENT_SERVICE_URL: Joi.string().uri().default('http://localhost:3004'),
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(60),
  DEFAULT_PASS_PERCENTAGE: Joi.number().min(0).max(100).default(50),
  ALLOW_TEACHER_PUBLISH: Joi.string().valid('true', 'false').default('false'),
  TRANSCRIPT_NUMBER_PREFIX: Joi.string().default('TR'),
  RESULT_PUBLISH_LOCK_TTL_SECONDS: Joi.number().default(30),
});
