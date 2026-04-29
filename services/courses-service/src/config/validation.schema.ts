import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3003),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  CLIENT_URL: Joi.string().default('http://localhost:3000'),
  INTERNAL_SECRET: Joi.string().required(),
  AUTH_SERVICE_URL: Joi.string().uri().default('http://localhost:3001'),
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(60),
  MIN_COURSE_CREDITS: Joi.number().min(0).default(1),
  MAX_COURSE_CREDITS: Joi.number().min(1).default(10),
  ALLOW_DECIMAL_CREDITS: Joi.string().valid('true', 'false').default('false'),
});
