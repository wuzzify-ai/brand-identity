import { describe, expect, it } from "vitest";
import type { WorkflowStageSummary } from "../src/lib/identity-api";
import {
  getAdjacentStage,
  getOverallCompletion,
  getRecommendedStage,
  isStageAvailable,
  isStageComplete,
} from "../src/components/identity/workflow-steps";

const stages: WorkflowStageSummary[] = [
  {
    stage_key: "BRIEF",
    status: "COMPLETED",
    completion_percent: 100,
    stale_reason: null,
  },
  {
    stage_key: "STRATEGY",
    status: "COMPLETED",
    completion_percent: 100,
    stale_reason: null,
  },
  {
    stage_key: "VISUALS",
    status: "READY",
    completion_percent: 100,
    stale_reason: null,
  },
  {
    stage_key: "ASSETS",
    status: "LOCKED",
    completion_percent: 0,
    stale_reason: null,
  },
  {
    stage_key: "FINALIZE",
    status: "LOCKED",
    completion_percent: 0,
    stale_reason: null,
  },
];

describe("workflow step navigation", () => {
  it("recommends the furthest unlocked step and blocks jumping forward", () => {
    expect(getRecommendedStage(stages)).toBe("VISUALS");
    expect(isStageAvailable(stages, "VISUALS")).toBe(true);
    expect(isStageAvailable(stages, "ASSETS")).toBe(false);
    expect(getAdjacentStage(stages, "VISUALS", 1)).toBeNull();
    expect(getAdjacentStage(stages, "VISUALS", -1)).toBe("STRATEGY");
  });

  it("does not treat generated visual options as a completed selection", () => {
    expect(isStageComplete(stages, "BRIEF")).toBe(true);
    expect(isStageComplete(stages, "VISUALS")).toBe(false);
    expect(getOverallCompletion(stages)).toBe(60);
  });

  it("treats assets as complete when finalization has been unlocked", () => {
    const processedStages = stages.map((stage) =>
      stage.stage_key === "ASSETS"
        ? { ...stage, status: "READY", completion_percent: 100 }
        : stage.stage_key === "FINALIZE"
          ? { ...stage, status: "NOT_STARTED" }
          : stage,
    );

    expect(isStageComplete(processedStages, "ASSETS")).toBe(true);
    expect(getAdjacentStage(processedStages, "ASSETS", 1)).toBe("FINALIZE");
  });
});
