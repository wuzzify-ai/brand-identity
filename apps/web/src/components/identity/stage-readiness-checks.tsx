'use client';

import { useCallback, useEffect, useState } from 'react';
import { normalizeApiError } from '../../lib/api-client';
import { generateBrandBook } from '../../lib/finalize-api';
import {
  startCompetitorResearchGeneration,
  startLogoConceptGeneration,
  startStrategyGeneration,
  startVisualDirectionGeneration,
  waitForGeneration
} from '../../lib/generation-api';
import { getIdentityVersionReadiness, type StageReadinessAction, type StageReadinessItem, type WorkflowStageSummary } from '../../lib/identity-api';
import { Button } from '../ui/button';

type StageReadinessChecksProps = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  refreshSignal?: number;
  onNavigateToStage?: (stageKey: WorkflowStageSummary['stage_key']) => void;
  onWorkflowChanged?: (stageKey?: WorkflowStageSummary['stage_key']) => void | Promise<void>;
};

const statusLabels: Record<StageReadinessItem['status'], string> = {
  READY: 'Ready',
  BLOCKED: 'Blocked',
  NEEDS_INPUT: 'Needs input',
  IN_PROGRESS: 'In progress',
  COMPLETE: 'Complete'
};

export function StageReadinessChecks({
  accessToken,
  workspaceId,
  projectId,
  versionId,
  refreshSignal = 0,
  onNavigateToStage,
  onWorkflowChanged
}: StageReadinessChecksProps) {
  const [items, setItems] = useState<StageReadinessItem[]>([]);
  const [status, setStatus] = useState('Loading stage readiness...');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async (nextStatus = 'Stage readiness loaded.') => {
    const next = await getIdentityVersionReadiness(accessToken, workspaceId, projectId, versionId);
    setItems(next);
    setStatus(nextStatus);
    return next;
  }, [accessToken, workspaceId, projectId, versionId]);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const next = await getIdentityVersionReadiness(accessToken, workspaceId, projectId, versionId);
        if (active) {
          setItems(next);
          setStatus('Stage readiness loaded.');
        }
      } catch (caught) {
        if (active) setStatus(normalizeApiError(caught).message);
      }
    }

    void loadInitial();

    return () => {
      active = false;
    };
  }, [accessToken, workspaceId, projectId, versionId, refreshSignal]);

  async function refresh() {
    try {
      setStatus('Refreshing stage readiness...');
      await load();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function runAction(action: StageReadinessAction) {
    const actionKey = `${action.stage_key}:${action.code}`;
    setBusyAction(actionKey);

    try {
      await performReadinessAction(action);
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function performReadinessAction(action: StageReadinessAction): Promise<void> {
    if (action.code === 'NAVIGATE_STAGE') {
      onNavigateToStage?.(action.stage_key);
      setStatus(`Opened ${action.stage_key.toLowerCase()} for review.`);
      return;
    }

    if (action.code === 'REFRESH_READINESS') {
      setStatus('Refreshing stage readiness...');
      await load();
      return;
    }

    if (action.code === 'RUN_COMPETITOR_RESEARCH') {
      setStatus('Research Strategist is checking competitors...');
      const generation = await startCompetitorResearchGeneration(accessToken, {
        workspaceId,
        identityVersionId: versionId,
        maxCompetitors: 5
      });
      await waitForGeneration(accessToken, generation.job.id, (state) => {
        setStatus(state.job.progress_message ?? `Research progress: ${state.job.progress_percent}%`);
      }, 180_000);
      onNavigateToStage?.('STRATEGY');
      await onWorkflowChanged?.('STRATEGY');
      await load('Competitor research completed. Strategy is ready for a grounded AI pass.');
      return;
    }

    if (action.code === 'RUN_STRATEGY_GENERATION') {
      setStatus('Strategy Writer is generating the brand strategy...');
      const generation = await startStrategyGeneration(accessToken, {
        workspaceId,
        identityVersionId: versionId,
        mode: 'full'
      });
      await waitForGeneration(accessToken, generation.job.id, (state) => {
        setStatus(state.job.progress_message ?? `Strategy progress: ${state.job.progress_percent}%`);
      }, 180_000);
      onNavigateToStage?.('STRATEGY');
      await onWorkflowChanged?.('STRATEGY');
      await load('Strategy generated. Review and complete the Strategy step.');
      return;
    }

    if (action.code === 'RUN_VISUAL_DIRECTIONS') {
      setStatus('Visual Director is generating three visual directions...');
      const generation = await startVisualDirectionGeneration(accessToken, {
        workspaceId,
        identityVersionId: versionId,
        mode: 'batch'
      });
      await waitForGeneration(accessToken, generation.job.id, (state) => {
        setStatus(state.job.progress_message ?? `Visual direction progress: ${state.job.progress_percent}%`);
      }, 180_000);
      onNavigateToStage?.('VISUALS');
      await onWorkflowChanged?.('VISUALS');
      await load('Visual directions generated. Select the strongest direction.');
      return;
    }

    if (action.code === 'RUN_LOGO_CONCEPTS') {
      setStatus('Logo Designer is generating three logo concepts...');
      const generation = await startLogoConceptGeneration(accessToken, {
        workspaceId,
        identityVersionId: versionId,
        count: 3
      });
      await waitForGeneration(accessToken, generation.job.id, (state) => {
        setStatus(state.job.progress_message ?? `Logo progress: ${state.job.progress_percent}%`);
      }, 180_000);
      onNavigateToStage?.('ASSETS');
      await onWorkflowChanged?.('ASSETS');
      await load('Logo concepts generated. Review and select the strongest option.');
      return;
    }

    if (action.code === 'RUN_BRAND_BOOK') {
      setStatus('Brand Book Writer is compiling the final brand book...');
      await generateBrandBook(accessToken, workspaceId, projectId, versionId);
      onNavigateToStage?.('FINALIZE');
      await onWorkflowChanged?.('FINALIZE');
      await load('Brand book generated. Review, approve, and activate it for other AI employees.');
    }
  }

  return (
    <section className="panel panel-pad" aria-live="polite">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="workflow-eyebrow">Stage readiness</p>
          <h2 className="section-title">Can the next employee work?</h2>
          <p className="section-copy">
            Each stage is checked for prerequisites, user decisions, and blockers before the next AI employee continues.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={Boolean(busyAction)}>
          Refresh checks
        </Button>
      </div>

      <p className="section-copy">{status}</p>

      {items.length ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {items.map((item) => (
            <ReadinessCard
              key={item.stage_key}
              item={item}
              busyAction={busyAction}
              onAction={(action) => void runAction(action)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReadinessCard({
  item,
  busyAction,
  onAction
}: {
  item: StageReadinessItem;
  busyAction: string | null;
  onAction: (action: StageReadinessAction) => void;
}) {
  return (
    <article className="panel panel-pad" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{item.stage_key} · {item.employee_role}</h3>
          <p className="section-copy">{item.summary}</p>
        </div>
        <span style={{ color: statusColor(item.status), fontWeight: 850 }}>{statusLabels[item.status]}</span>
      </div>

      {item.reasons.length ? (
        <div>
          <h4 style={{ margin: '0 0 6px' }}>Why</h4>
          <ul style={{ margin: 0 }}>
            {item.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      ) : null}

      {item.recommended_actions.length ? (
        <div>
          <h4 style={{ margin: '0 0 6px' }}>Next action</h4>
          <ul style={{ margin: 0 }}>
            {item.recommended_actions.map((action) => <li key={action}>{action}</li>)}
          </ul>
        </div>
      ) : null}

      {item.actions.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {item.actions.map((action) => {
            const actionKey = `${action.stage_key}:${action.code}`;
            const isBusy = busyAction === actionKey;
            return (
              <Button
                key={actionKey}
                type="button"
                variant={action.style === 'secondary' ? 'secondary' : 'primary'}
                disabled={Boolean(busyAction)}
                onClick={() => onAction(action)}
              >
                {isBusy ? 'Working...' : action.label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function statusColor(status: StageReadinessItem['status']): string {
  if (status === 'COMPLETE' || status === 'READY') return 'var(--wz-purple)';
  if (status === 'BLOCKED') return 'var(--color-coral)';
  if (status === 'NEEDS_INPUT' || status === 'IN_PROGRESS') return 'var(--color-gold)';
  return 'var(--color-muted)';
}
