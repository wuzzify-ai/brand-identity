import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class InMemoryRateLimiterService {
  private readonly buckets = new Map<string, Bucket>();

  consume(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (bucket.count >= limit) {
      throw new DomainError('RATE_LIMITED', 'Too many attempts. Try again later.', 429);
    }

    bucket.count += 1;
  }
}
