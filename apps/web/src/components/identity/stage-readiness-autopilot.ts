import type { StageReadinessAction, StageReadinessItem, WorkflowStageSummary } from '../../lib/identity-api';

export const autopilotGenerationActionCodes = new Set<StageReadinessAction['code']>([
  'RUN_COMPETITOR_RESEARCH',
  'RUN_STRATEGY_GENERATION',
  'RUN_VISUAL_DIRECTIONS',
  'RUN_LOGO_CONCEPTS',
  'RUN_BRAND_BOOK'
]);

const stageOrder: WorkflowStageSummary['stage_key'][] = ['BRIEF', 'STRATEGY', 'VISUALS', 'ASSETS', 'FINALIZE'];

export function isAutopilotGenerationAction(action: StageReadinessAction): boolean {
  return autopilotGenerationActionCodes.has(action.code);
}

export function selectNextAutopilotAction(items: StageReadinessItem[]): StageReadinessAction | null {
  const orderedItems = stageOrder
    .map((stageKey) => items.find((item) => item.stage_key === stageKey))
    .filter((item): item is StageReadinessItem => Boolean(item));

  for (const item of orderedItems) {
    if (item.status === 'COMPLETE') continue;
    if (item.status === 'IN_PROGRESS') return item.actions.find((action) => action.code === 'REFRESH_READINESS') ?? null;

    const primaryGenerationAction = item.actions.find(
      (action) => action.style === 'primary' && isAutopilotGenerationAction(action)
    );
    if (primaryGenerationAction) return primaryGenerationAction;

    const humanGateAction = item.actions.find((action) => action.code === 'NAVIGATE_STAGE');
    if (humanGateAction) return humanGateAction;
  }

  return null;
}
