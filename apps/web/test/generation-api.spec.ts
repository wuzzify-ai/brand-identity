import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startCompetitorResearchGeneration } from '../src/lib/generation-api';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('generation API helpers', () => {
  it('starts competitor research as a strategy-stage generation job', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/v1');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ job: { id: 'job-id', status: 'QUEUED', progress_percent: 5 } }), { status: 200 })
    );

    await startCompetitorResearchGeneration('token', {
      workspaceId: 'workspace-id',
      identityVersionId: 'version-id',
      competitorNames: ['Zapier'],
      market: 'US SMB automation',
      maxCompetitors: 5,
      userInstructions: 'Focus on no-code tools.'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/v1/generations',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include'
      })
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Headers).get('authorization')).toBe('Bearer token');
    expect((request.headers as Headers).get('idempotency-key')).toContain('competitor-research-version-id');
    expect(JSON.parse(String(request.body))).toMatchObject({
      workspaceId: 'workspace-id',
      identityVersionId: 'version-id',
      workflowStageKey: 'STRATEGY',
      task: 'COMPETITOR_RESEARCH',
      input: {
        competitorNames: ['Zapier'],
        market: 'US SMB automation',
        maxCompetitors: 5,
        userInstructions: 'Focus on no-code tools.'
      }
    });
  });
});
