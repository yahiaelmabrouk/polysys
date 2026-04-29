import { LoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';

const { combine, timestamp, errors, json, colorize, simple } = format;

const isDev = process.env.NODE_ENV !== 'production';

const winstonInstance: Logger = createLogger({
  level: isDev ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    isDev ? combine(colorize(), simple()) : json(),
  ),
  defaultMeta: { service: 'courses-service' },
  transports: [
    new transports.Console(),
    ...(isDev
      ? []
      : [
          new transports.File({ filename: 'logs/error.log', level: 'error' }),
          new transports.File({ filename: 'logs/combined.log' }),
        ]),
  ],
});

export class WinstonLoggerService implements LoggerService {
  log(message: string, context?: string): void {
    winstonInstance.info(message, { context });
  }
  error(message: string, trace?: string, context?: string): void {
    winstonInstance.error(message, { trace, context });
  }
  warn(message: string, context?: string): void {
    winstonInstance.warn(message, { context });
  }
  debug(message: string, context?: string): void {
    winstonInstance.debug(message, { context });
  }
  verbose(message: string, context?: string): void {
    winstonInstance.verbose(message, { context });
  }
}

export const winstonLogger = new WinstonLoggerService();
