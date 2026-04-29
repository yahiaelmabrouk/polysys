import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { AuditLogModule } from './common/services/audit-log.service';
import { ClientsModule } from './clients/clients.module';
import { LocksModule } from './locks/locks.module';

import { CapacityModule } from './capacity/capacity.module';
import { RegistrationWindowsModule } from './registration-windows/registration-windows.module';
import { WaitlistsModule } from './waitlists/waitlists.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { RosterModule } from './roster/roster.module';
import { InternalModule } from './internal/internal.module';

import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestContextMiddleware } from './middleware/request-context.middleware';

import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl') || 60,
            limit: config.get<number>('throttle.limit') || 60,
          },
        ],
      }),
    }),
    DatabaseModule,
    EventsModule,
    AuditLogModule,
    ClientsModule,
    LocksModule,
    CapacityModule,
    RegistrationWindowsModule,
    WaitlistsModule,
    EnrollmentsModule,
    RosterModule,
    InternalModule,
  ],
  controllers: [AppController],
  providers: [
    JwtAccessStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
