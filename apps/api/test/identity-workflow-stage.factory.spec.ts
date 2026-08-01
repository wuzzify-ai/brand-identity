import { describe, expect, it } from 'vitest';
import { WorkflowStageKey, WorkflowStageStatus } from '../src/database/entities';
import { createDefaultWorkflowStages, slugifyProjectName } from '../src/identity-projects/workflow-stage.factory';

describe('createDefaultWorkflowStages', () => {
  it('creates five ordered stages with only brief unlocked', () => {
    expect(createDefaultWorkflowStages()).toEqual([
      { stageKey: WorkflowStageKey.Brief, status: WorkflowStageStatus.NotStarted, completionPercent: 0 },
      { stageKey: WorkflowStageKey.Strategy, status: WorkflowStageStatus.Locked, completionPercent: 0 },
      { stageKey: WorkflowStageKey.Visuals, status: WorkflowStageStatus.Locked, completionPercent: 0 },
      { stageKey: WorkflowStageKey.Assets, status: WorkflowStageStatus.Locked, completionPercent: 0 },
      { stageKey: WorkflowStageKey.Finalize, status: WorkflowStageStatus.Locked, completionPercent: 0 }
    ]);
  });
});

describe('slugifyProjectName', () => {
  it('creates stable lowercase slugs', () => {
    expect(slugifyProjectName('  Cairo Coffee & Design  ')).toBe('cairo-coffee-design');
    expect(slugifyProjectName('***')).toBe('brand-identity');
  });
});
