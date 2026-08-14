'use client';

import { useEffect, useState } from 'react';
import { normalizeApiError } from '../../lib/api-client';
import {
  advanceAutopilotRun,
  cancelAutopilotRun,
  getAutopilotHistory,
  getCurrentAutopilotRun,
  retryAutopilotRun,
  type AiEmployeeAutopilotEvent,
  type AiEmployeeAutopilotHistoryItem,
  type AiEmployeeAutopilotRun
} from '../../lib/autopilot-api';
import { waitForGeneration } from '../../lib/generation-api';
import type { WorkflowStageSummary } from '../../lib/identity-api';
import { Button } from '../ui/button';

type AiEmployeeAutopilotControlCenterProps = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  refreshSignal?: number;
  onNavigateToStage?: (stageKey: WorkflowStageSummary['stage_key']) => void;
  onWorkflowChanged?: (stageKey?: WorkflowStageSummary['stage_key']) => void | Promise<void>;
};

const activeStatuses = new Set<AiEmployeeAutopilotRun['status']>(['RUNNING', 'PAUSED']);

export function AiEmployeeAutopilotControlCenter({
  accessToken,
  workspaceId,
  projectId,
  versionId,
  refreshSignal = 0,
  onNavigateToStage,
  onWorkflowChanged
}: AiEmployeeAutopilotControlCenterProps) {
  const [run, setRun] = useState<AiEmployeeAutopilotRun | null>(null);
  const [events, setEvents] = useState<AiEmployeeAutopilotEvent[]>([]);
  const [history, setHistory] = useState<AiEmployeeAutopilotHistoryItem[]>([]);
  const [status, setStatus] = useState('Loading Autopilot control center...');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [current, runs] = await Promise.all([
          getCurrentAutopilotRun(accessToken, workspaceId, projectId, versionId),
          getAutopilotHistory(accessToken, workspaceId, projectId, versionId, 8)
        ]);
        if (!active) return;
        setRun(current.run);
        setEvents(current.events);
        setHistory(runs.runs);
        setStatus(current.run ? 'Autopilot session loaded.' : 'No active Autopilot session.');
      } catch (caught) {
        if (active) setStatus(normalizeApiError(caught).message);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [accessToken, workspaceId, projectId, versionId, refreshSignal]);

  async function refresh(nextStatus = 'Autopilot control center refreshed.') {
    const [current, runs] = await Promise.all([
      getCurrentAutopilotRun(accessToken, workspaceId, projectId, versionId),
      getAutopilotHistory(accessToken, workspaceId, projectId, versionId, 8)
    ]);
    setRun(current.run);
    setEvents(current.events);
    setHistory(runs.runs);
    setStatus(nextStatus);
  }

  async function runAdvance() {
    setBusy('advance');
    try {
      for (let step = 0; step < 6; step += 1) {
        setStatus(step === 0 ? 'Autopilot is asking the backend for the next safe move...' : 'Autopilot is continuing server-side...');
        const advanced = await advanceAutopilotRun(accessToken, workspaceId, projectId, versionId);
        setRun(advanced.run);
        setEvents(advanced.events);
        setStatus(advanced.message);

        if (advanced.run?.current_stage_key && (advanced.status === 'PAUSED' || advanced.status === 'COMPLETED')) {
          onNavigateToStage?.(advanced.run.current_stage_key);
        }

        if (advanced.status !== 'JOB_STARTED' || !advanced.generationJobId) {
          await onWorkflowChanged?.();
          await refresh(advanced.message);
          return;
        }

        await waitForGeneration(accessToken, advanced.generationJobId, (state) => {
          setStatus(state.job.progress_message ?? `Autopilot job progress: ${state.job.progress_percent}%`);
        }, 180_000);
        await onWorkflowChanged?.();
      }

      await refresh('Autopilot paused after several backend advances. Click continue to keep going.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  async function cancelRun() {
    if (!run) return;
    setBusy('cancel');
    try {
      const current = await cancelAutopilotRun(accessToken, workspaceId, projectId, versionId, run.id, 'Autopilot cancelled by agency user.');
      setRun(current.run);
      setEvents(current.events);
      await refresh('Autopilot cancelled.');
      await onWorkflowChanged?.();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  async function retryRun(runId: string) {
    setBusy(`retry:${runId}`);
    try {
      const current = await retryAutopilotRun(accessToken, workspaceId, projectId, versionId, runId);
      setRun(current.run);
      setEvents(current.events);
      await refresh('Autopilot retry started.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel panel-pad" aria-live="polite">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="workflow-eyebrow">AI employee autopilot</p>
          <h2 className="section-title">Control center</h2>
          <p className="section-copy">
            Start, resume, cancel, or retry the AI employee workflow while keeping a durable run history.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" onClick={() => void runAdvance()} disabled={Boolean(busy)}>
            {busy === 'advance' ? 'Working...' : run?.status === 'PAUSED' ? 'Resume Autopilot' : 'Run AI autopilot'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={Boolean(busy)}>
            Refresh
          </Button>
          {run && activeStatuses.has(run.status) ? (
            <Button type="button" variant="secondary" onClick={() => void cancelRun()} disabled={Boolean(busy)}>
              {busy === 'cancel' ? 'Cancelling...' : 'Cancel'}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="section-copy">{status}</p>

      {run ? <RunCard run={run} events={events} /> : null}

      {history.length ? (
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <h3 style={{ margin: 0 }}>Run history</h3>
          {history.map((item) => (
            <article key={item.id} className="panel panel-pad" style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{item.status} · {formatDate(item.created_at)}</h4>
                  <p className="section-copy" style={{ marginTop: 4 }}>
                    {item.latest_event_message ?? 'No events recorded.'}
                  </p>
                </div>
                <span style={{ color: statusColor(item.status), fontWeight: 850 }}>{item.completed_steps} completed</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {item.status === 'FAILED' || item.status === 'CANCELLED' ? (
                  <Button type="button" variant="secondary" onClick={() => void retryRun(item.id)} disabled={Boolean(busy)}>
                    {busy === `retry:${item.id}` ? 'Retrying...' : 'Retry'}
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RunCard({ run, events }: { run: AiEmployeeAutopilotRun; events: AiEmployeeAutopilotEvent[] }) {
  return (
    <div className="panel panel-pad" style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Current session</h3>
          <p className="section-copy" style={{ marginTop: 4 }}>
            {run.status}
            {run.current_stage_key ? ` · ${run.current_stage_key}` : ''}
            {run.last_action_code ? ` · ${run.last_action_code}` : ''}
          </p>
        </div>
        <span style={{ color: statusColor(run.status), fontWeight: 850 }}>{run.completed_steps} completed</span>
      </div>
      {run.pause_reason ? <p className="section-copy">{run.pause_reason}</p> : null}
      {run.error_message ? <p className="section-copy" style={{ color: 'var(--color-coral)' }}>{run.error_message}</p> : null}
      {events.length ? (
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {events.slice(-5).map((event) => (
            <li key={event.id}>{event.event_type}: {event.message}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function statusColor(status: AiEmployeeAutopilotRun['status']): string {
  if (status === 'FAILED' || status === 'CANCELLED') return 'var(--color-coral)';
  if (status === 'PAUSED') return 'var(--color-gold)';
  return 'var(--wz-purple)';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
