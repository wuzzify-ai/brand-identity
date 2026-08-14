import { describe, expect, it, vi } from 'vitest';
import { GenerationTask, WorkflowStageKey } from '../src/database/entities';
import { IdentityProjectsService } from '../src/identity-projects/identity-projects.service';

describe('IdentityProjectsService autopilot', () => {
  it('starts an autopilot run and writes a start event', async () => {
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'run-id', status: 'RUNNING' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'event-id', message: 'AI Employee Autopilot started.' }])
    };
    const service = new IdentityProjectsService(dataSource as never);

    const result = await service.startAutopilot('workspace-id', 'project-id', 'version-id', 'user-id');

    expect(result.run).toMatchObject({ id: 'run-id', status: 'RUNNING' });
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_employee_autopilot_runs'), [
      'workspace-id',
      'project-id',
      'version-id',
      'user-id',
      JSON.stringify({ source: 'readiness_panel' })
    ]);
  });

  it('reuses an existing active autopilot run', async () => {
    const existingRun = { id: 'run-id', status: 'RUNNING' };
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([existingRun])
        .mockResolvedValueOnce([])
    };
    const service = new IdentityProjectsService(dataSource as never);

    const result = await service.startAutopilot('workspace-id', 'project-id', 'version-id', 'user-id');

    expect(result.run).toBe(existingRun);
    expect(dataSource.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_employee_autopilot_runs'), expect.anything());
  });

  it('advances by queueing the next safe generation job', async () => {
    const existingRun = { id: 'run-id', status: 'RUNNING', completed_steps: 0 };
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([existingRun])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([
          {
            version_status: 'DRAFT',
            brief_confirmed: true,
            competitor_research_ready: false,
            strategy_confirmed: false,
            strategy_complete: false,
            visual_direction_exists: false,
            visual_direction_selected: false,
            logo_concept_exists: false,
            logo_concept_selected: false,
            brand_book_ready: false,
            has_running_job: false,
            stage_statuses: {
              BRIEF: 'COMPLETED',
              STRATEGY: 'READY',
              VISUALS: 'LOCKED',
              ASSETS: 'LOCKED',
              FINALIZE: 'LOCKED'
            }
          }
        ])
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([{ id: 'run-id' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'run-id', status: 'RUNNING', completed_steps: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'run-id', status: 'RUNNING', completed_steps: 0 }])
        .mockResolvedValueOnce([])
    };
    const generations = {
      create: vi.fn().mockResolvedValue({ job: { id: 'job-id' } })
    };
    const service = new IdentityProjectsService(dataSource as never, generations as never);

    const result = await service.advanceAutopilot('workspace-id', 'project-id', 'version-id', 'user-id');

    expect(result).toMatchObject({
      status: 'JOB_STARTED',
      generationJobId: 'job-id'
    });
    expect(generations.create).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({
        workspaceId: 'workspace-id',
        identityVersionId: 'version-id',
        workflowStageKey: WorkflowStageKey.Strategy,
        task: GenerationTask.CompetitorResearch
      }),
      'autopilot-run-id-1-RUN_COMPETITOR_RESEARCH'
    );
  });

  it('lists autopilot history with latest event summary', async () => {
    const historyRows = [
      {
        id: 'run-id',
        status: 'CANCELLED',
        event_count: 2,
        latest_event_type: 'CANCELLED',
        latest_event_message: 'Stopped.',
        latest_event_at: '2026-08-13T10:00:00.000Z'
      }
    ];
    const dataSource = {
      query: vi.fn().mockResolvedValueOnce([{ id: 'version-id' }]).mockResolvedValueOnce(historyRows)
    };
    const service = new IdentityProjectsService(dataSource as never);

    const result = await service.autopilotHistory('workspace-id', 'project-id', 'version-id', 100);

    expect(result.runs).toBe(historyRows);
    expect(dataSource.query).toHaveBeenLastCalledWith(expect.stringContaining('LIMIT $2'), ['version-id', 50]);
  });

  it('cancels an active autopilot run and records a cancellation event', async () => {
    const cancelledRun = { id: 'run-id', status: 'CANCELLED', pause_reason: 'Stop now.' };
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([{ id: 'run-id' }])
        .mockResolvedValueOnce([cancelledRun])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'event-id', event_type: 'CANCELLED' }])
    };
    const service = new IdentityProjectsService(dataSource as never);

    const result = await service.cancelAutopilot('workspace-id', 'project-id', 'version-id', 'run-id', 'Stop now.');

    expect(result.run).toBe(cancelledRun);
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining("SET status = 'CANCELLED'"), ['run-id', 'Stop now.']);
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_employee_autopilot_events'), [
      'run-id',
      null,
      'CANCELLED',
      null,
      null,
      'Stop now.',
      JSON.stringify({})
    ]);
  });

  it('retries a terminal autopilot run by creating a new active run', async () => {
    const retryRun = { id: 'new-run-id', status: 'RUNNING' };
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([{ id: 'run-id' }])
        .mockResolvedValueOnce([{ id: 'run-id', status: 'FAILED' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([retryRun])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'event-id', event_type: 'STARTED' }])
    };
    const service = new IdentityProjectsService(dataSource as never);

    const result = await service.retryAutopilot('workspace-id', 'project-id', 'version-id', 'run-id', 'user-id');

    expect(result.run).toBe(retryRun);
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_employee_autopilot_runs'), [
      'workspace-id',
      'project-id',
      'version-id',
      'user-id',
      JSON.stringify({ source: 'readiness_panel', retryOfRunId: 'run-id' })
    ]);
  });
});
