'use client';

import { useEffect, useMemo, useState } from 'react';
import { normalizeApiError } from '../../lib/api-client';
import { getIdentityVersionActivity, type AiEmployeeActivityItem } from '../../lib/identity-api';
import { Button } from '../ui/button';

type AiEmployeeActivityLogProps = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  refreshSignal?: number;
};

const taskLabels: Record<string, string> = {
  BRIEF_EXTRACT: 'Brief extractor',
  BRIEF_IMPROVE: 'Brief improver',
  COMPETITOR_RESEARCH: 'Research strategist',
  STRATEGY_GENERATE: 'Strategy writer',
  STRATEGY_SECTION_REGENERATE: 'Strategy editor',
  VISUAL_DIRECTIONS_GENERATE: 'Visual director',
  VISUAL_VARIATION_GENERATE: 'Visual variation designer',
  LOGO_CONCEPTS_GENERATE: 'Logo designer',
  BRAND_BOOK_NARRATIVE_GENERATE: 'Brand book writer',
  QUALITY_REVIEW: 'Quality reviewer'
};

const runningStatuses = new Set(['QUEUED', 'RUNNING', 'CANCEL_REQUESTED', 'STALLED']);

export function AiEmployeeActivityLog({ accessToken, workspaceId, projectId, versionId, refreshSignal = 0 }: AiEmployeeActivityLogProps) {
  const [items, setItems] = useState<AiEmployeeActivityItem[]>([]);
  const [status, setStatus] = useState('Loading AI employee activity...');
  const hasRunningWork = useMemo(() => items.some((item) => runningStatuses.has(item.status)), [items]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const next = await getIdentityVersionActivity(accessToken, workspaceId, projectId, versionId);
        if (!active) return;
        setItems(next);
        setStatus(next.length ? 'AI employee activity loaded.' : 'No AI employee work yet.');
      } catch (caught) {
        if (!active) return;
        setStatus(normalizeApiError(caught).message);
      }
    }

    void load();
    const interval = window.setInterval(() => {
      if (active) void load();
    }, hasRunningWork ? 3_000 : 10_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [accessToken, workspaceId, projectId, versionId, refreshSignal, hasRunningWork]);

  async function refresh() {
    try {
      setStatus('Refreshing AI employee activity...');
      const next = await getIdentityVersionActivity(accessToken, workspaceId, projectId, versionId);
      setItems(next);
      setStatus(next.length ? 'AI employee activity loaded.' : 'No AI employee work yet.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  return (
    <section className="panel panel-pad" aria-live="polite">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="workflow-eyebrow">AI employee log</p>
          <h2 className="section-title">Work history</h2>
          <p className="section-copy">
            See what the AI employees have done for this identity: research, generation, reviews, artifacts, and failures.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          Refresh log
        </Button>
      </div>

      <p className="section-copy">{status}</p>

      {items.length ? (
        <ol style={{ display: 'grid', gap: 10, margin: '16px 0 0', padding: 0, listStyle: 'none' }}>
          {items.map((item) => (
            <ActivityItem key={item.id} item={item} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ActivityItem({ item }: { item: AiEmployeeActivityItem }) {
  const label = taskLabels[item.task] ?? item.task.replaceAll('_', ' ').toLowerCase();
  const time = item.completed_at ?? item.failed_at ?? item.started_at ?? item.created_at;

  return (
    <li className="panel panel-pad" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{label}</h3>
          <p className="section-copy" style={{ marginTop: 4 }}>
            {item.workflow_stage_key} · {item.status} · {item.progress_percent}% · {formatDate(time)}
          </p>
        </div>
        <span style={{ color: statusColor(item.status), fontWeight: 800 }}>{item.status}</span>
      </div>

      {item.progress_message ? <p className="section-copy">{item.progress_message}</p> : null}
      {item.error_message ? <p className="section-copy" style={{ color: 'var(--color-coral)' }}>{item.error_message}</p> : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: 'var(--color-muted)', fontSize: 13 }}>
        <span>Attempts {item.attempts}/{item.max_attempts}</span>
        {item.latest_model ? <span>Model {item.latest_model}</span> : null}
        {item.latest_provider ? <span>Provider {item.latest_provider}</span> : null}
        {item.total_tokens ? <span>{item.total_tokens} tokens</span> : null}
        <span>{item.artifact_count} artifact{item.artifact_count === 1 ? '' : 's'}</span>
      </div>

      {item.artifact_names.length ? (
        <p className="section-copy">Artifacts: {item.artifact_names.join(' · ')}</p>
      ) : null}
    </li>
  );
}

function formatDate(value: string | null): string {
  if (!value) return 'not started';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function statusColor(status: string): string {
  if (status === 'SUCCEEDED') return 'var(--wz-purple)';
  if (status === 'FAILED' || status === 'CANCELLED') return 'var(--color-coral)';
  if (runningStatuses.has(status)) return 'var(--color-gold)';
  return 'var(--color-muted)';
}
