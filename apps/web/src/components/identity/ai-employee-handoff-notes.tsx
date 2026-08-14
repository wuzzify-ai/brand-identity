'use client';

import { useEffect, useState } from 'react';
import { normalizeApiError } from '../../lib/api-client';
import { getIdentityVersionHandoffs, type AiEmployeeHandoffItem } from '../../lib/identity-api';
import { Button } from '../ui/button';

type AiEmployeeHandoffNotesProps = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  refreshSignal?: number;
};

export function AiEmployeeHandoffNotes({ accessToken, workspaceId, projectId, versionId, refreshSignal = 0 }: AiEmployeeHandoffNotesProps) {
  const [items, setItems] = useState<AiEmployeeHandoffItem[]>([]);
  const [status, setStatus] = useState('Loading AI handoff notes...');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const next = await getIdentityVersionHandoffs(accessToken, workspaceId, projectId, versionId);
        if (!active) return;
        setItems(next);
        setStatus(next.length ? 'AI handoff notes loaded.' : 'No AI handoff notes yet.');
      } catch (caught) {
        if (!active) return;
        setStatus(normalizeApiError(caught).message);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [accessToken, workspaceId, projectId, versionId, refreshSignal]);

  async function refresh() {
    try {
      setStatus('Refreshing AI handoff notes...');
      const next = await getIdentityVersionHandoffs(accessToken, workspaceId, projectId, versionId);
      setItems(next);
      setStatus(next.length ? 'AI handoff notes loaded.' : 'No AI handoff notes yet.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  return (
    <section className="panel panel-pad" aria-live="polite">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="workflow-eyebrow">AI employee handoff</p>
          <h2 className="section-title">Notes for the next employee</h2>
          <p className="section-copy">
            Each AI employee leaves concise context for the next one, like a human team passing work forward.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          Refresh notes
        </Button>
      </div>

      <p className="section-copy">{status}</p>

      {items.length ? (
        <ol style={{ display: 'grid', gap: 10, margin: '16px 0 0', padding: 0, listStyle: 'none' }}>
          {items.map((item) => (
            <HandoffNote key={item.id} item={item} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function HandoffNote({ item }: { item: AiEmployeeHandoffItem }) {
  return (
    <li className="panel panel-pad" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>{item.employee_role}</h3>
          <p className="section-copy" style={{ marginTop: 4 }}>
            {item.from_stage_key}
            {item.to_stage_key ? ` → ${item.to_stage_key}` : ''} · {item.task.replaceAll('_', ' ').toLowerCase()}
          </p>
        </div>
        {item.is_current ? <span style={{ color: 'var(--wz-purple)', fontWeight: 800 }}>Current</span> : null}
      </div>

      <p className="section-copy">{item.summary}</p>

      {item.notes.length ? (
        <div>
          <h4 style={{ margin: '0 0 6px' }}>What I found</h4>
          <ul style={{ margin: 0 }}>
            {item.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
      ) : null}

      {item.recommendations.length ? (
        <div>
          <h4 style={{ margin: '0 0 6px' }}>Recommended next move</h4>
          <ul style={{ margin: 0 }}>
            {item.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
