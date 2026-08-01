'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { BriefEditor } from '../../../../src/components/identity/brief-editor';
import { AssetsManager } from '../../../../src/components/identity/assets-manager';
import { FinalizePanel } from '../../../../src/components/identity/finalize-panel';
import { StrategyEditor } from '../../../../src/components/identity/strategy-editor';
import { VisualDirectionsEditor } from '../../../../src/components/identity/visual-directions-editor';
import { ErrorState } from '../../../../src/components/ui/error-state';
import { Skeleton } from '../../../../src/components/ui/skeleton';
import { getIdentityProject, listIdentityVersions, type WorkflowStageSummary } from '../../../../src/lib/identity-api';
import { useAuth } from '../../../../src/providers/auth-provider';

const stageLabels: Record<WorkflowStageSummary['stage_key'], string> = {
  BRIEF: 'Brief',
  STRATEGY: 'Strategy',
  VISUALS: 'Visuals',
  ASSETS: 'Assets',
  FINALIZE: 'Finalize'
};

function isStageAvailable(stages: WorkflowStageSummary[] | null, stageKey: WorkflowStageSummary['stage_key']) {
  const stage = stages?.find((item) => item.stage_key === stageKey);
  return Boolean(stage && stage.status !== 'LOCKED');
}

function ProjectWorkspaceContent() {
  const auth = useAuth();
  const params = useParams<{ projectId: string }>();
  const workspaceId = useSearchParams().get('workspaceId');
  const [projectName, setProjectName] = useState<string | null>(null);
  const [initialBusinessDescription, setInitialBusinessDescription] = useState<string | null>(null);
  const [stages, setStages] = useState<WorkflowStageSummary[] | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!auth.accessToken || !workspaceId) {
      return;
    }

    void Promise.all([
      getIdentityProject(auth.accessToken, workspaceId, params.projectId),
      listIdentityVersions(auth.accessToken, workspaceId, params.projectId)
    ])
      .then(([project, versions]) => {
        setProjectName(project.name);
        setInitialBusinessDescription(project.metadata?.initialDescription ?? null);
        setStages(versions[0]?.stages ?? []);
        setVersionId(versions[0]?.id ?? null);
      })
      .catch(setError);
  }, [auth.accessToken, params.projectId, workspaceId]);

  if (error) {
    return <main className="workspace"><ErrorState error={error} /></main>;
  }

  return (
    <main className="workspace">
      <section className="panel panel-pad">
        <h1 className="section-title">{projectName ?? 'Brand identity'}</h1>
        <p className="section-copy">Move through the staged identity workflow as each section unlocks.</p>
        {!stages ? <Skeleton /> : null}
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {stages?.map((stage) => (
            <article key={stage.stage_key} className="panel panel-pad" aria-disabled={stage.status === 'LOCKED'}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{stageLabels[stage.stage_key]}</h2>
              <p className="section-copy">{stage.status} - {stage.completion_percent}% complete</p>
            </article>
          ))}
        </div>
      </section>
      {auth.accessToken && workspaceId && versionId ? (
        <div style={{ marginTop: 24 }}>
          {isStageAvailable(stages, 'BRIEF') ? (
            <BriefEditor
              accessToken={auth.accessToken}
            workspaceId={workspaceId}
            projectId={params.projectId}
            versionId={versionId}
            initialBusinessDescription={initialBusinessDescription}
            onCompleted={() => {
                void listIdentityVersions(auth.accessToken as string, workspaceId, params.projectId).then((versions) => {
                  setStages(versions[0]?.stages ?? []);
                });
              }}
            />
          ) : null}
          {isStageAvailable(stages, 'STRATEGY') ? (
            <div style={{ marginTop: 24 }}>
              <StrategyEditor
                accessToken={auth.accessToken}
                workspaceId={workspaceId}
                projectId={params.projectId}
                versionId={versionId}
                onCompleted={() => {
                  void listIdentityVersions(auth.accessToken as string, workspaceId, params.projectId).then((versions) => {
                    setStages(versions[0]?.stages ?? []);
                  });
                }}
              />
            </div>
          ) : null}
          {isStageAvailable(stages, 'VISUALS') ? (
            <div style={{ marginTop: 24 }}>
              <VisualDirectionsEditor
                accessToken={auth.accessToken}
                workspaceId={workspaceId}
                projectId={params.projectId}
                versionId={versionId}
                onSelected={() => {
                  void listIdentityVersions(auth.accessToken as string, workspaceId, params.projectId).then((versions) => {
                    setStages(versions[0]?.stages ?? []);
                  });
                }}
              />
            </div>
          ) : null}
          {isStageAvailable(stages, 'ASSETS') ? (
            <div style={{ marginTop: 24 }}>
              <AssetsManager
                accessToken={auth.accessToken}
                workspaceId={workspaceId}
                projectId={params.projectId}
                versionId={versionId}
                onChanged={() => {
                  void listIdentityVersions(auth.accessToken as string, workspaceId, params.projectId).then((versions) => {
                    setStages(versions[0]?.stages ?? []);
                  });
                }}
              />
            </div>
          ) : null}
          {isStageAvailable(stages, 'FINALIZE') ? (
            <div style={{ marginTop: 24 }}>
              <FinalizePanel
                accessToken={auth.accessToken}
                workspaceId={workspaceId}
                projectId={params.projectId}
                versionId={versionId}
                onChanged={() => {
                  void listIdentityVersions(auth.accessToken as string, workspaceId, params.projectId).then((versions) => {
                    setStages(versions[0]?.stages ?? []);
                  });
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

export default function ProjectWorkspacePage() {
  return (
    <Suspense fallback={<main className="workspace"><Skeleton /></main>}>
      <ProjectWorkspaceContent />
    </Suspense>
  );
}
