import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

type HealthResponse = {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  dependencies?: Record<string, 'ok' | 'error'>;
};

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService
  ) {}

  live(): HealthResponse {
    return {
      status: 'ok',
      service: 'brand-identity-api',
      timestamp: new Date().toISOString()
    };
  }

  async ready(): Promise<HealthResponse> {
    const dependencies: Record<string, 'ok' | 'error'> = {
      database: 'error',
      redis: 'error'
    };

    try {
      await this.dataSource.query('select 1');
      dependencies.database = 'ok';
    } catch {
      dependencies.database = 'error';
    }

    const redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });

    try {
      await redis.connect();
      await redis.ping();
      dependencies.redis = 'ok';
    } catch {
      dependencies.redis = 'error';
    } finally {
      redis.disconnect();
    }

    const isReady = Object.values(dependencies).every((status) => status === 'ok');
    const payload: HealthResponse = {
      status: isReady ? 'ok' : 'error',
      service: 'brand-identity-api',
      timestamp: new Date().toISOString(),
      dependencies
    };

    if (!isReady) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
