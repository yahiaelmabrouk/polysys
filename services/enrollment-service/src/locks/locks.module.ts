import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * RedisLockService
 *
 * Implements a SET NX EX based mutual-exclusion lock with a token-guarded
 * release (Redlock-lite). When Redis is unavailable, a process-local
 * Map-based fallback is used so the service still works in dev/CI; the
 * fallback is NOT safe across processes and must not be relied upon in
 * production deployments — Redis MUST be reachable.
 *
 * Usage:
 *   await locks.withLock(`enroll:${courseId}:${term}`, async () => { ... });
 */
@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly localLocks = new Map<string, number>();
  private readonly defaultTtlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    config: ConfigService,
  ) {
    this.defaultTtlSeconds =
      config.get<number>('app.enrollmentLockTtlSeconds') || 10;
  }

  async acquire(
    key: string,
    ttlSeconds: number = this.defaultTtlSeconds,
  ): Promise<string | null> {
    const token = randomUUID();
    if (this.redis) {
      const res = await this.redis.set(
        this.k(key),
        token,
        'EX',
        ttlSeconds,
        'NX',
      );
      return res === 'OK' ? token : null;
    }
    // Local fallback
    const now = Date.now();
    const existing = this.localLocks.get(key);
    if (existing && existing > now) return null;
    this.localLocks.set(key, now + ttlSeconds * 1000);
    return token;
  }

  async release(key: string, token: string): Promise<void> {
    if (this.redis) {
      const lua = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end`;
      try {
        await this.redis.eval(lua, 1, this.k(key), token);
      } catch (err) {
        this.logger.warn(
          `Lock release failed for ${key}: ${(err as Error).message}`,
        );
      }
      return;
    }
    this.localLocks.delete(key);
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    opts: { ttlSeconds?: number; retries?: number; retryDelayMs?: number } = {},
  ): Promise<T> {
    const ttl = opts.ttlSeconds ?? this.defaultTtlSeconds;
    const retries = opts.retries ?? 5;
    const delay = opts.retryDelayMs ?? 100;

    let token: string | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      token = await this.acquire(key, ttl);
      if (token) break;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    if (!token) {
      throw new Error(`Could not acquire lock: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        /* swallow */
      }
    }
  }

  private k(key: string): string {
    return `enrollment-service:lock:${key}`;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const logger = new Logger('RedisClient');
        try {
          const client = new Redis({
            host: config.get<string>('redis.host') || 'localhost',
            port: config.get<number>('redis.port') || 6379,
            password: config.get<string>('redis.password') || undefined,
            lazyConnect: false,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
          });
          client.on('error', (err) => {
            logger.warn(`Redis error: ${err.message}`);
          });
          return client;
        } catch (err) {
          logger.warn(
            `Redis unavailable, falling back to in-process locks: ${(err as Error).message}`,
          );
          return null;
        }
      },
    },
    RedisLockService,
  ],
  exports: [RedisLockService, REDIS_CLIENT],
})
export class LocksModule {}
