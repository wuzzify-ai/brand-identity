import type { WorkflowStageSummary } from "../../lib/identity-api";

export type WorkflowStageKey = WorkflowStageSummary["stage_key"];

export const workflowStepDefinitions: ReadonlyArray<{
  key: WorkflowStageKey;
  label: string;
  description: string;
}> = [
  {
    key: "BRIEF",
    label: "Brief",
    description: "Define the business and audience",
  },
  {
    key: "STRATEGY",
    label: "Strategy",
    description: "Shape positioning and messaging",
  },
  {
    key: "VISUALS",
    label: "Visuals",
    description: "Choose the visual direction",
  },
  {
    key: "ASSETS",
    label: "Assets",
    description: "Generate and select brand assets",
  },
  {
    key: "FINALIZE",
    label: "Finalize",
    description: "Review, export, and activate",
  },
];

export function isStageAvailable(
  stages: WorkflowStageSummary[] | null,
  stageKey: WorkflowStageKey,
): boolean {
  if (stageKey === "BRIEF") return true;

  return (
    stages?.some(
      (stage) => stage.stage_key === stageKey && stage.status !== "LOCKED",
    ) ?? false
  );
}

export function getStage(
  stages: WorkflowStageSummary[] | null,
  stageKey: WorkflowStageKey,
) {
  return stages?.find((stage) => stage.stage_key === stageKey) ?? null;
}

export function isStageComplete(
  stages: WorkflowStageSummary[] | null,
  stageKey: WorkflowStageKey,
): boolean {
  const stage = getStage(stages, stageKey);
  if (!stage) return false;
  if (stage.status === "COMPLETED") return true;

  // Asset generation/upload intentionally leaves the stage READY. The backend
  // unlocks FINALIZE only after an asset has been processed successfully.
  return stageKey === "ASSETS" && isStageAvailable(stages, "FINALIZE");
}

export function getRecommendedStage(
  stages: WorkflowStageSummary[] | null,
): WorkflowStageKey {
  const available = workflowStepDefinitions.filter((step) =>
    isStageAvailable(stages, step.key),
  );
  return available.at(-1)?.key ?? "BRIEF";
}

export function getAdjacentStage(
  stages: WorkflowStageSummary[] | null,
  current: WorkflowStageKey,
  direction: -1 | 1,
): WorkflowStageKey | null {
  const currentIndex = workflowStepDefinitions.findIndex(
    (step) => step.key === current,
  );
  const adjacent = workflowStepDefinitions[currentIndex + direction];
  return adjacent && isStageAvailable(stages, adjacent.key)
    ? adjacent.key
    : null;
}

export function getOverallCompletion(
  stages: WorkflowStageSummary[] | null,
): number {
  if (!stages?.length) return 0;
  const total = workflowStepDefinitions.reduce(
    (sum, step) => sum + (getStage(stages, step.key)?.completion_percent ?? 0),
    0,
  );
  return Math.round(total / workflowStepDefinitions.length);
}

export function formatStageStatus(status: string): string {
  const labels: Record<string, string> = {
    LOCKED: "Locked",
    NOT_STARTED: "Not started",
    GENERATING: "Generating",
    NEEDS_INPUT: "Needs input",
    READY: "Ready",
    COMPLETED: "Completed",
    STALE: "Needs review",
    FAILED: "Failed",
  };
  return labels[status] ?? status.toLowerCase().replaceAll("_", " ");
}
