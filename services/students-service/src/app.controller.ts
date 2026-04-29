import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'students-service',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'degraded',
        service: 'students-service',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
