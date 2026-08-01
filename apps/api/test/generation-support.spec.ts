import { describe, expect, it } from 'vitest';
import { GenerationJobStatus } from '../src/database/entities';
import { redisConnectionOptions } from '../src/generations/generation-queue.service';
import { assertGenerationTransition, terminalGenerationStatuses } from '../src/generations/generation-state-machine';

describe('generation support', () => {
  it('accepts planned state transitions and rejects invalid terminal moves', () => {
    expect(() => assertGenerationTransition(GenerationJobStatus.Queued, GenerationJobStatus.Running)).not.toThrow();
    expect(() => assertGenerationTransition(GenerationJobStatus.Running, GenerationJobStatus.Succeeded)).not.toThrow();
    expect(() => assertGenerationTransition(GenerationJobStatus.Succeeded, GenerationJobStatus.Running)).toThrow(
      'Cannot move generation job from SUCCEEDED to RUNNING.'
    );
    expect(terminalGenerationStatuses.has(GenerationJobStatus.Succeeded)).toBe(true);
  });

  it('parses redis URLs for queue connections', () => {
    expect(redisConnectionOptions('rediss://user:pass@redis.example.test:6380/2')).toMatchObject({
      host: 'redis.example.test',
      port: 6380,
      username: 'user',
      password: 'pass',
      db: 2,
      maxRetriesPerRequest: null
    });
  });
});
