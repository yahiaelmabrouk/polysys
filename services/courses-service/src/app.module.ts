import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { AuditLogModule } from './common/services/audit-log.service';

import { DepartmentsModule } from './departments/departments.module';
import { SubjectsModule } from './subjects/subjects.module';
import { CoursesModule } from './courses/courses.module';
import { PrerequisitesModule } from './prerequisites/prerequisites.module';
import { TeacherAssignmentsModule } from './teacher-assignments/teacher-assignments.module';
import { CatalogModule } from './catalog/catalog.module';
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
    DepartmentsModule,
    SubjectsModule,
    CoursesModule,
    PrerequisitesModule,
    TeacherAssignmentsModule,
    CatalogModule,
    InternalModule,
  ],
  controllers: [AppController],
  providers: [
    JwtAccessStrategy,
    // Global guards (order matters)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Global exception filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Global interceptors
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
