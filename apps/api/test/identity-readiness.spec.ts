import { describe, expect, it, vi } from 'vitest';
import { IdentityProjectsService } from '../src/identity-projects/identity-projects.service';

describe('IdentityProjectsService readiness', () => {
  it('returns executable action metadata for the next AI employee step', async () => {
    const dataSource = {
      query: vi
        .fn()
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
    };
    const service = new IdentityProjectsService(dataSource as never);

    const readiness = await service.readiness('workspace-id', 'project-id', 'version-id');
    const strategy = readiness.find((item) => item.stage_key === 'STRATEGY');

    expect(strategy).toMatchObject({
      employee_role: 'Research Strategist',
      status: 'NEEDS_INPUT',
      actions: [
        { code: 'RUN_COMPETITOR_RESEARCH', label: 'Run competitor research', stage_key: 'STRATEGY', style: 'primary' },
        { code: 'RUN_STRATEGY_GENERATION', label: 'Generate strategy anyway', stage_key: 'STRATEGY', style: 'secondary' }
      ]
    });
  });

  it('offers brand book generation once visual and logo selections are ready', async () => {
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'version-id' }])
        .mockResolvedValueOnce([
          {
            version_status: 'DRAFT',
            brief_confirmed: true,
            competitor_research_ready: true,
            strategy_confirmed: true,
            strategy_complete: true,
            visual_direction_exists: true,
            visual_direction_selected: true,
            logo_concept_exists: true,
            logo_concept_selected: true,
            brand_book_ready: false,
            has_running_job: false,
            stage_statuses: {
              BRIEF: 'COMPLETED',
              STRATEGY: 'COMPLETED',
              VISUALS: 'COMPLETED',
              ASSETS: 'COMPLETED',
              FINALIZE: 'READY'
            }
          }
        ])
    };
    const service = new IdentityProjectsService(dataSource as never);

    const readiness = await service.readiness('workspace-id', 'project-id', 'version-id');
    const finalize = readiness.find((item) => item.stage_key === 'FINALIZE');

    expect(finalize).toMatchObject({
      employee_role: 'Brand Book Writer',
      status: 'READY',
      actions: [{ code: 'RUN_BRAND_BOOK', label: 'Generate brand book', stage_key: 'FINALIZE', style: 'primary' }]
    });
  });
});
