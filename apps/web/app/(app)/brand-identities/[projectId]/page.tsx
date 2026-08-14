"use client";

import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AiEmployeeActivityLog } from "../../../../src/components/identity/ai-employee-activity-log";
import { AiEmployeeAutopilotControlCenter } from "../../../../src/components/identity/ai-employee-autopilot-control-center";
import { AiEmployeeHandoffNotes } from "../../../../src/components/identity/ai-employee-handoff-notes";
import { AssetsManager } from "../../../../src/components/identity/assets-manager";
import { BriefEditor } from "../../../../src/components/identity/brief-editor";
import { FinalizePanel } from "../../../../src/components/identity/finalize-panel";
import { StageReadinessChecks } from "../../../../src/components/identity/stage-readiness-checks";
import { StrategyEditor } from "../../../../src/components/identity/strategy-editor";
import { VisualDirectionsEditor } from "../../../../src/components/identity/visual-directions-editor";
import { WorkflowStepper } from "../../../../src/components/identity/workflow-stepper";
import {
  getAdjacentStage,
  getRecommendedStage,
  isStageAvailable,
  workflowStepDefinitions,
  type WorkflowStageKey,
} from "../../../../src/components/identity/workflow-steps";
import { Button } from "../../../../src/components/ui/button";
import { ErrorState } from "../../../../src/components/ui/error-state";
import { Skeleton } from "../../../../src/components/ui/skeleton";
import {
  getIdentityProject,
  listIdentityVersions,
  type WorkflowStageSummary,
} from "../../../../src/lib/identity-api";
import { useAuth } from "../../../../src/providers/auth-provider";

function isWorkflowStageKey(value: string | null): value is WorkflowStageKey {
  return workflowStepDefinitions.some((step) => step.key === value);
}

type AiCockpitPanel = "readiness" | "autopilot" | "activity" | "handoff";

const aiCockpitTabs: Array<{
  key: AiCockpitPanel;
  label: string;
  description: string;
}> = [
  {
    key: "readiness",
    label: "Next move",
    description: "See blockers and the safest action for the current step.",
  },
  {
    key: "autopilot",
    label: "Autopilot",
    description: "Run or resume the AI employee workflow.",
  },
  {
    key: "activity",
    label: "Work log",
    description: "Review jobs, artifacts, failures, and model usage.",
  },
  {
    key: "handoff",
    label: "Handoffs",
    description: "Read notes passed between AI employees.",
  },
];

function ProjectWorkspaceContent() {
  const auth = useAuth();
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");
  const requestedStage = searchParams.get("step");
  const [projectName, setProjectName] = useState<string | null>(null);
  const [initialBusinessDescription, setInitialBusinessDescription] = useState<
    string | null
  >(null);
  const [stages, setStages] = useState<WorkflowStageSummary[] | null>(null);
  const [activeStage, setActiveStage] = useState<WorkflowStageKey>("BRIEF");
  const [activeAiPanel, setActiveAiPanel] =
    useState<AiCockpitPanel>("readiness");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [workflowRefreshSignal, setWorkflowRefreshSignal] = useState(0);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!auth.accessToken || !workspaceId) return;

    void Promise.all([
      getIdentityProject(auth.accessToken, workspaceId, params.projectId),
      listIdentityVersions(auth.accessToken, workspaceId, params.projectId),
    ])
      .then(([project, versions]) => {
        setProjectName(project.name);
        setInitialBusinessDescription(
          project.metadata?.initialDescription ?? null,
        );
        setStages(versions[0]?.stages ?? []);
        setVersionId(versions[0]?.id ?? null);
      })
      .catch(setError);
  }, [auth.accessToken, params.projectId, workspaceId]);

  function replaceStageInUrl(stageKey: WorkflowStageKey) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("step", stageKey);
    router.replace(`${pathname}?${nextSearchParams.toString()}`, {
      scroll: false,
    });
  }

  function navigateToStage(
    stageKey: WorkflowStageKey,
    knownStages: WorkflowStageSummary[] | null = stages,
  ) {
    if (!isStageAvailable(knownStages, stageKey)) return;
    setActiveStage(stageKey);
    if (requestedStage !== stageKey) replaceStageInUrl(stageKey);
  }

  useEffect(() => {
    if (!stages?.length) return;

    const resolvedStage =
      isWorkflowStageKey(requestedStage) &&
      isStageAvailable(stages, requestedStage)
        ? requestedStage
        : getRecommendedStage(stages);

    if (resolvedStage !== activeStage) setActiveStage(resolvedStage);
    if (resolvedStage !== requestedStage) replaceStageInUrl(resolvedStage);
    // This effect responds to server workflow state and direct-link step changes.
    // eslint is not configured with react-hooks in this repo.
  }, [stages, requestedStage]);

  async function refreshWorkflow(completedStage?: WorkflowStageKey) {
    if (!auth.accessToken || !workspaceId) return;

    try {
      const versions = await listIdentityVersions(
        auth.accessToken,
        workspaceId,
        params.projectId,
      );
      const refreshedStages = versions[0]?.stages ?? [];
      setStages(refreshedStages);
      setWorkflowRefreshSignal((current) => current + 1);

      if (completedStage) {
        const nextStage = getAdjacentStage(refreshedStages, completedStage, 1);
        if (nextStage) navigateToStage(nextStage, refreshedStages);
      }
    } catch (caught) {
      setError(caught);
    }
  }

  if (error) {
    return (
      <main className="workspace">
        <ErrorState error={error} />
      </main>
    );
  }

  const activeDefinition =
    workflowStepDefinitions.find((step) => step.key === activeStage) ??
    workflowStepDefinitions[0]!;
  const previousStage = getAdjacentStage(stages, activeStage, -1);
  const nextStage = getAdjacentStage(stages, activeStage, 1);
  const nextDefinition =
    workflowStepDefinitions[
      workflowStepDefinitions.findIndex((step) => step.key === activeStage) + 1
    ];
  const canRenderWorkflow = Boolean(
    auth.accessToken && workspaceId && versionId && stages,
  );

  return (
    <main className="workspace">
      <section className="panel panel-pad workflow-hero">
        <div className="workflow-hero-copy">
          <p className="workflow-eyebrow">Wuzzify Brand Studio</p>
          <h1 className="section-title">{projectName ?? "Brand identity"}</h1>
          <p className="section-copy">
            Complete one focused step at a time. Your work is saved in each
            section before the next one unlocks.
          </p>
        </div>
        {!stages ? (
          <Skeleton />
        ) : (
          <WorkflowStepper
            stages={stages}
            activeStage={activeStage}
            onStageChange={(stageKey) => navigateToStage(stageKey)}
          />
        )}
      </section>

      {canRenderWorkflow ? (
        <>
          <section className="panel panel-pad workflow-cockpit">
            <div className="workflow-cockpit-header">
              <div>
                <p className="workflow-eyebrow">AI employee cockpit</p>
                <h2 className="section-title">Guided brand team</h2>
                <p className="section-copy">
                  Keep the wizard focused while still giving the agency a clear
                  view of readiness, automation, logs, and handoffs.
                </p>
              </div>
              <div
                className="workflow-cockpit-tabs"
                role="tablist"
                aria-label="AI employee cockpit panels"
              >
                {aiCockpitTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeAiPanel === tab.key}
                    className={`workflow-cockpit-tab${
                      activeAiPanel === tab.key ? " is-active" : ""
                    }`}
                    onClick={() => setActiveAiPanel(tab.key)}
                  >
                    <strong>{tab.label}</strong>
                    <span>{tab.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="workflow-cockpit-panel">
              {activeAiPanel === "readiness" ? (
                <StageReadinessChecks
                  accessToken={auth.accessToken as string}
                  workspaceId={workspaceId as string}
                  projectId={params.projectId}
                  versionId={versionId as string}
                  refreshSignal={workflowRefreshSignal}
                  onNavigateToStage={(stageKey) => navigateToStage(stageKey)}
                  onWorkflowChanged={(stageKey) => refreshWorkflow(stageKey)}
                />
              ) : null}

              {activeAiPanel === "autopilot" ? (
                <AiEmployeeAutopilotControlCenter
                  accessToken={auth.accessToken as string}
                  workspaceId={workspaceId as string}
                  projectId={params.projectId}
                  versionId={versionId as string}
                  refreshSignal={workflowRefreshSignal}
                  onNavigateToStage={(stageKey) => navigateToStage(stageKey)}
                  onWorkflowChanged={(stageKey) => refreshWorkflow(stageKey)}
                />
              ) : null}

              {activeAiPanel === "activity" ? (
                <AiEmployeeActivityLog
                  accessToken={auth.accessToken as string}
                  workspaceId={workspaceId as string}
                  projectId={params.projectId}
                  versionId={versionId as string}
                  refreshSignal={workflowRefreshSignal}
                />
              ) : null}

              {activeAiPanel === "handoff" ? (
                <AiEmployeeHandoffNotes
                  accessToken={auth.accessToken as string}
                  workspaceId={workspaceId as string}
                  projectId={params.projectId}
                  versionId={versionId as string}
                  refreshSignal={workflowRefreshSignal}
                />
              ) : null}
            </div>
          </section>

          <header className="workflow-stage-heading">
            <p>{activeDefinition.description}</p>
            <p>Only this step is shown</p>
          </header>

          <div key={activeStage} className="workflow-stage-content">
            {activeStage === "BRIEF" ? (
              <BriefEditor
                accessToken={auth.accessToken as string}
                workspaceId={workspaceId as string}
                projectId={params.projectId}
                versionId={versionId as string}
                initialBusinessDescription={initialBusinessDescription}
                onCompleted={() => void refreshWorkflow("BRIEF")}
              />
            ) : null}

            {activeStage === "STRATEGY" ? (
              <StrategyEditor
                accessToken={auth.accessToken as string}
                workspaceId={workspaceId as string}
                projectId={params.projectId}
                versionId={versionId as string}
                onCompleted={() => void refreshWorkflow("STRATEGY")}
              />
            ) : null}

            {activeStage === "VISUALS" ? (
              <VisualDirectionsEditor
                accessToken={auth.accessToken as string}
                workspaceId={workspaceId as string}
                projectId={params.projectId}
                versionId={versionId as string}
                onSelected={() => void refreshWorkflow("VISUALS")}
              />
            ) : null}

            {activeStage === "ASSETS" ? (
              <AssetsManager
                accessToken={auth.accessToken as string}
                workspaceId={workspaceId as string}
                projectId={params.projectId}
                versionId={versionId as string}
                onChanged={() => void refreshWorkflow("ASSETS")}
              />
            ) : null}

            {activeStage === "FINALIZE" ? (
              <FinalizePanel
                accessToken={auth.accessToken as string}
                workspaceId={workspaceId as string}
                projectId={params.projectId}
                versionId={versionId as string}
                onChanged={() => void refreshWorkflow()}
              />
            ) : null}
          </div>

          <nav
            className="panel workflow-wizard-navigation"
            aria-label="Step navigation"
          >
            <Button
              type="button"
              variant="secondary"
              disabled={!previousStage}
              onClick={() => previousStage && navigateToStage(previousStage)}
            >
              Back
            </Button>
            <p>
              {nextDefinition && !nextStage
                ? `Complete ${activeDefinition.label.toLowerCase()} to unlock ${nextDefinition.label}.`
                : nextStage
                  ? `Continue when you are ready. You can return to this step later.`
                  : "This is the final step of the identity workflow."}
            </p>
            {nextDefinition ? (
              <Button
                type="button"
                disabled={!nextStage}
                onClick={() => nextStage && navigateToStage(nextStage)}
              >
                Next: {nextDefinition.label}
              </Button>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        </>
      ) : null}
    </main>
  );
}

export default function ProjectWorkspacePage() {
  return (
    <Suspense
      fallback={
        <main className="workspace">
          <Skeleton />
        </main>
      }
    >
      <ProjectWorkspaceContent />
    </Suspense>
  );
}
