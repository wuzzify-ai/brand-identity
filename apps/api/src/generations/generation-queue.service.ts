import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';

const queueName = 'brand-identity-generations';

@Injectable()
export class GenerationQueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(config: ConfigService) {
    this.queue = new Queue(queueName, {
      connection: redisConnectionOptions(config.getOrThrow<string>('REDIS_URL'))
    });
  }

  async enqueue(jobId: string, maxAttempts: number): Promise<string> {
    const job = await this.queue.add(
      'generation',
      { jobId },
      {
        jobId,
        attempts: maxAttempts,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    return String(job.id);
  }

  async requestCancel(jobId: string): Promise<boolean> {
    const job = await Job.fromId(this.queue, jobId);

    if (!job) {
      return false;
    }

    if (await job.isActive()) {
      return false;
    }

    await job.remove();
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

export function redisConnectionOptions(redisUrl: string) {
  const parsed = new URL(redisUrl);
  const db = parsed.pathname ? Number(parsed.pathname.slice(1)) : 0;

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isNaN(db) ? 0 : db,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null
  };
}
