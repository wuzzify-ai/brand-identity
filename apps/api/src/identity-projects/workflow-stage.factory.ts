import { WorkflowStageKey, WorkflowStageStatus } from '../database/entities';

export type DefaultWorkflowStage = {
  stageKey: WorkflowStageKey;
  status: WorkflowStageStatus;
  completionPercent: number;
};

export function createDefaultWorkflowStages(): DefaultWorkflowStage[] {
  return [
    { stageKey: WorkflowStageKey.Brief, status: WorkflowStageStatus.NotStarted, completionPercent: 0 },
    { stageKey: WorkflowStageKey.Strategy, status: WorkflowStageStatus.Locked, completionPercent: 0 },
    { stageKey: WorkflowStageKey.Visuals, status: WorkflowStageStatus.Locked, completionPercent: 0 },
    { stageKey: WorkflowStageKey.Assets, status: WorkflowStageStatus.Locked, completionPercent: 0 },
    { stageKey: WorkflowStageKey.Finalize, status: WorkflowStageStatus.Locked, completionPercent: 0 }
  ];
}

export function slugifyProjectName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'brand-identity';
}
