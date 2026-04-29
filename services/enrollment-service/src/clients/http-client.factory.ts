import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * Thin HTTP wrapper used by the cross-service clients.
 *
 * - Adds the X-Internal-Secret header on every call.
 * - Normalizes the platform's `{ success, data, ... }` envelope by
 *   returning `data` to callers.
 * - Returns `null` on 404 so callers can branch on existence.
 */
@Injectable()
export class HttpClientFactory {
  private readonly logger = new Logger(HttpClientFactory.name);
  private readonly internalSecret: string;

  constructor(private readonly config: ConfigService) {
    this.internalSecret =
      this.config.get<string>('app.internalSecret') || 'missing-internal-secret';
  }

  create(baseURL: string, opts: AxiosRequestConfig = {}): AxiosInstance {
    const instance = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'X-Internal-Secret': this.internalSecret,
        'Content-Type': 'application/json',
      },
      ...opts,
    });
    return instance;
  }

  async getOrNull<T>(
    instance: AxiosInstance,
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<T | null> {
    try {
      const res = await instance.get(url, config);
      const body = res.data;
      if (body && typeof body === 'object' && 'data' in body) {
        return (body as { data: T }).data;
      }
      return body as T;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      this.logger.warn(
        `HTTP ${url} failed: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
