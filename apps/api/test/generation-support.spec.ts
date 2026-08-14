import { describe, expect, it, vi } from 'vitest';
import { AiGenerationTier, GenerationJobStatus, GenerationTask, WorkflowStageKey, WorkspaceRole } from '../src/database/entities';
import { redisConnectionOptions } from '../src/generations/generation-queue.service';
import { GenerationsService } from '../src/generations/generations.service';
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

  it('pins the active brand context package when creating a generation for the active version', async () => {
    const checksum = 'a'.repeat(64);
    const insertedJob = {
      id: 'job-id',
      workspace_id: 'workspace-id',
      identity_version_id: 'version-id',
      brand_context_package_id: 'package-id',
      brand_context_package_checksum_sha256: checksum,
      status: GenerationJobStatus.Queued,
      idempotency_key: 'idem-key',
      bullmq_job_id: null
    };
    const managerQuery = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'version-id',
          active_version_id: 'version-id',
          active_context_package_id: 'package-id',
          active_context_package_checksum_sha256: checksum
        }
      ])
      .mockResolvedValueOnce([{ id: 'stage-id' }])
      .mockResolvedValueOnce([insertedJob])
      .mockResolvedValueOnce([]);
    const dataSource = {
      transaction: vi.fn(async (callback: (manager: { query: typeof managerQuery }) => Promise<unknown>) =>
        callback({ query: managerQuery })
      ),
      query: vi
        .fn()
        .mockResolvedValueOnce([{ used_micro_usd: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...insertedJob, bullmq_job_id: 'bull-job' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
    };
    const service = new GenerationsService(
      dataSource as never,
      { findActiveMembership: vi.fn().mockResolvedValue({ role: WorkspaceRole.Editor }) } as never,
      { enqueue: vi.fn().mockResolvedValue('bull-job') } as never,
      { get: vi.fn().mockReturnValue(undefined) } as never
    );

    await service.create(
      'user-id',
      {
        workspaceId: 'workspace-id',
        identityVersionId: 'version-id',
        workflowStageKey: WorkflowStageKey.Assets,
        task: GenerationTask.QualityReview,
        tier: AiGenerationTier.Balanced,
        input: {}
      },
      'idem-key'
    );

    const insertCall = managerQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO generation_jobs'));
    expect(insertCall?.[1]).toEqual([
      'workspace-id',
      'version-id',
      WorkflowStageKey.Assets,
      GenerationTask.QualityReview,
      AiGenerationTier.Balanced,
      'idem-key',
      'user-id',
      '{}',
      'package-id',
      checksum,
      2
    ]);
  });
});
