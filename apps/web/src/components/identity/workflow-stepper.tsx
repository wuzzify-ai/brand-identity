"use client";

import { Check, Lock } from "lucide-react";
import type { WorkflowStageSummary } from "../../lib/identity-api";
import {
  formatStageStatus,
  getOverallCompletion,
  getStage,
  isStageAvailable,
  isStageComplete,
  workflowStepDefinitions,
  type WorkflowStageKey,
} from "./workflow-steps";
import "./workflow-stepper.css";

type Props = {
  stages: WorkflowStageSummary[];
  activeStage: WorkflowStageKey;
  onStageChange: (stage: WorkflowStageKey) => void;
};

export function WorkflowStepper({ stages, activeStage, onStageChange }: Props) {
  const overallCompletion = getOverallCompletion(stages);
  const activeIndex = workflowStepDefinitions.findIndex(
    (step) => step.key === activeStage,
  );

  return (
    <nav
      className="workflow-stepper"
      aria-label="Brand identity creation steps"
    >
      <div className="workflow-progress-heading">
        <div>
          <strong>
            Step {activeIndex + 1} of {workflowStepDefinitions.length}
          </strong>
          <span>{overallCompletion}% overall completion</span>
        </div>
        <span aria-hidden="true">{overallCompletion}%</span>
      </div>
      <div
        className="workflow-progress-track"
        role="progressbar"
        aria-label="Overall identity progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={overallCompletion}
      >
        <span style={{ width: `${overallCompletion}%` }} />
      </div>

      <ol className="workflow-step-list">
        {workflowStepDefinitions.map((definition, index) => {
          const stage = getStage(stages, definition.key);
          const available = isStageAvailable(stages, definition.key);
          const complete = isStageComplete(stages, definition.key);
          const active = activeStage === definition.key;

          return (
            <li key={definition.key} className="workflow-step-item">
              {index > 0 ? (
                <span
                  className={`workflow-step-connector${complete || active ? " is-reached" : ""}`}
                  aria-hidden="true"
                />
              ) : null}
              <button
                type="button"
                className={`workflow-step-button${active ? " is-active" : ""}${complete ? " is-complete" : ""}`}
                disabled={!available}
                aria-current={active ? "step" : undefined}
                onClick={() => onStageChange(definition.key)}
              >
                <span className="workflow-step-marker" aria-hidden="true">
                  {complete ? (
                    <Check size={16} strokeWidth={3} />
                  ) : available ? (
                    index + 1
                  ) : (
                    <Lock size={14} />
                  )}
                </span>
                <span className="workflow-step-text">
                  <strong>{definition.label}</strong>
                  <small>
                    {stage ? formatStageStatus(stage.status) : "Unavailable"} ·{" "}
                    {stage?.completion_percent ?? 0}%
                  </small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
