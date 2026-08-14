import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceAutopilotRun,
  appendAutopilotEvent,
  cancelAutopilotRun,
  getAutopilotHistory,
  retryAutopilotRun,
  startAutopilotRun
} from '../src/lib/autopilot-api';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('autopilot API helpers', () => {
  it('starts an autopilot run for an identity version', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/v1');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ run: { id: 'run-id' }, events: [] }), { status: 200 })
    );

    await startAutopilotRun('token', 'workspace-id', 'project-id', 'version-id');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/v1/workspaces/workspace-id/brand-identities/project-id/versions/version-id/autopilot/start',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Headers).get('authorization')).toBe('Bearer token');
  });

  it('appends autopilot events with generation job context', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/v1');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ run: { id: 'run-id' }, events: [] }), { status: 200 })
    );

    await appendAutopilotEvent('token', 'workspace-id', 'project-id', 'version-id', 'run-id', {
      eventType: 'ACTION_SUCCEEDED',
      stageKey: 'STRATEGY',
      actionCode: 'RUN_COMPETITOR_RESEARCH',
      generationJobId: 'job-id',
      message: 'Research completed.'
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      eventType: 'ACTION_SUCCEEDED',
      stageKey: 'STRATEGY',
      actionCode: 'RUN_COMPETITOR_RESEARCH',
      generationJobId: 'job-id',
      message: 'Research completed.'
    });
  });

  it('advances an autopilot run server-side', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/v1');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ run: { id: 'run-id' }, events: [], status: 'JOB_STARTED', message: 'Queued.' }), { status: 200 })
    );

    await advanceAutopilotRun('token', 'workspace-id', 'project-id', 'version-id');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/v1/workspaces/workspace-id/brand-identities/project-id/versions/version-id/autopilot/advance',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('loads autopilot history with a limit', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/v1');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ runs: [] }), { status: 200 })
    );

    await getAutopilotHistory('token', 'workspace-id', 'project-id', 'version-id', 8);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/v1/workspaces/workspace-id/brand-identities/project-id/versions/version-id/autopilot/history?limit=8',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('cancels an autopilot run with a reason', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/v1');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ run: { id: 'run-id', status: 'CANCELLED' }, events: [] }), { status: 200 })
    );

    await cancelAutopilotRun('token', 'workspace-id', 'project-id', 'version-id', 'run-id', 'Stop now.');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/v1/workspaces/workspace-id/brand-identities/project-id/versions/version-id/autopilot/runs/run-id/cancel',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({ reason: 'Stop now.' });
  });

  it('retries a failed or cancelled autopilot run', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/v1');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ run: { id: 'new-run-id', status: 'RUNNING' }, events: [] }), { status: 200 })
    );

    await retryAutopilotRun('token', 'workspace-id', 'project-id', 'version-id', 'run-id');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/v1/workspaces/workspace-id/brand-identities/project-id/versions/version-id/autopilot/runs/run-id/retry',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });
});
