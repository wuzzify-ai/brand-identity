import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../generations/generation-queue.service';

const queueName = 'brand-identity-assets';

@Injectable()
export class AssetProcessingQueueService implements OnModuleDestroy {
  private readonly queue: Queue<{ assetId: string }>;

  constructor(config: ConfigService) {
    this.queue = new Queue(queueName, {
      connection: redisConnectionOptions(config.getOrThrow<string>('REDIS_URL'))
    });
  }

  async enqueue(assetId: string): Promise<string> {
    const job = await this.queue.add(
      'process-asset',
      { assetId },
      {
        jobId: assetId,
        attempts: 2,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    return String(job.id);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
