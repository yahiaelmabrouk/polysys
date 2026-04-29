import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import appConfig, { redisConfig } from '../config/app.config';

@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly client: Redis;

  constructor(
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
    @Inject(redisConfig.KEY) private readonly redis: ConfigType<typeof redisConfig>,
  ) {
    this.client = new Redis({
      host: this.redis.host,
      port: this.redis.port,
      password: this.redis.password,
      db: this.redis.db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    this.client.connect().catch((err) =>
      this.logger.warn(`Redis connection failed: ${(err as Error).message}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      /* noop */
    }
  }

  async acquire(
    key: string,
    ttlSeconds = this.app.resultPublishLockTtlSeconds,
  ): Promise<string | null> {
    const token = randomUUID();
    const result = await this.client.set(
      this.scopedKey(key),
      token,
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK' ? token : null;
  }

  async release(key: string, token: string): Promise<boolean> {
    // Compare-and-delete via Lua to avoid releasing someone else's lock
    const script = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;
    const released = (await this.client.eval(
      script,
      1,
      this.scopedKey(key),
      token,
    )) as number;
    return released === 1;
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const token = await this.acquire(key, ttlSeconds);
    if (!token) {
      throw new Error(`Could not acquire lock: ${key}`);
    }
    try {
      return await fn();
    } finally {
      await this.release(key, token).catch((err) =>
        this.logger.warn(`Failed to release lock ${key}: ${(err as Error).message}`),
      );
    }
  }

  private scopedKey(key: string): string {
    return `grades-service:lock:${key}`;
  }
}
