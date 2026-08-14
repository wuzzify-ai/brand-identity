import { describe, expect, it } from 'vitest';
import { selectNextAutopilotAction } from '../src/components/identity/stage-readiness-autopilot';
import type { StageReadinessItem } from '../src/lib/identity-api';

describe('stage readiness autopilot', () => {
  it('runs competitor research before strategy generation', () => {
    const action = selectNextAutopilotAction([
      completeItem('BRIEF'),
      item('STRATEGY', 'NEEDS_INPUT', [
        { code: 'RUN_COMPETITOR_RESEARCH', label: 'Run competitor research', stage_key: 'STRATEGY', style: 'primary' },
        { code: 'RUN_STRATEGY_GENERATION', label: 'Generate strategy anyway', stage_key: 'STRATEGY', style: 'secondary' }
      ])
    ]);

    expect(action?.code).toBe('RUN_COMPETITOR_RESEARCH');
  });

  it('pauses at human review gates instead of generating later stages', () => {
    const action = selectNextAutopilotAction([
      completeItem('BRIEF'),
      item('STRATEGY', 'NEEDS_INPUT', [
        { code: 'NAVIGATE_STAGE', label: 'Review strategy', stage_key: 'STRATEGY', style: 'primary' }
      ]),
      item('VISUALS', 'READY', [
        { code: 'RUN_VISUAL_DIRECTIONS', label: 'Generate visual directions', stage_key: 'VISUALS', style: 'primary' }
      ])
    ]);

    expect(action).toMatchObject({ code: 'NAVIGATE_STAGE', stage_key: 'STRATEGY' });
  });

  it('returns no action after all stages are complete', () => {
    expect(
      selectNextAutopilotAction([
        completeItem('BRIEF'),
        completeItem('STRATEGY'),
        completeItem('VISUALS'),
        completeItem('ASSETS'),
        completeItem('FINALIZE')
      ])
    ).toBeNull();
  });
});

function item(
  stageKey: StageReadinessItem['stage_key'],
  status: StageReadinessItem['status'],
  actions: StageReadinessItem['actions']
): StageReadinessItem {
  return {
    stage_key: stageKey,
    employee_role: 'AI employee',
    status,
    summary: '',
    reasons: [],
    recommended_actions: [],
    actions
  };
}

function completeItem(stageKey: StageReadinessItem['stage_key']): StageReadinessItem {
  return item(stageKey, 'COMPLETE', []);
}
