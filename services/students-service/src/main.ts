import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { winstonLogger } from './common/logger/winston.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3002;
  const clientUrl = configService.get<string>('app.clientUrl');
  const nodeEnv = configService.get<string>('app.nodeEnv');

  // ─── Security Headers ────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: nodeEnv === 'production',
    }),
  );

  // ─── Compression ─────────────────────────────────────────────────────────
  app.use(compression());

  // ─── CORS ────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [clientUrl || 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
    credentials: true,
  });

  // ─── Global Validation Pipe ──────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Students Service running on port ${port} [${nodeEnv}]`);
}

bootstrap().catch((err) => {
  console.error('Failed to start Students Service', err);
  process.exit(1);
});
