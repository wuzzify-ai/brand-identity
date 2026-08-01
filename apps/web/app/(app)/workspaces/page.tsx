'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LogIn, Plus, Send } from 'lucide-react';
import { Button } from '../../../src/components/ui/button';
import { TextField } from '../../../src/components/ui/form';
import { normalizeApiError } from '../../../src/lib/api-client';
import { createWorkspace, inviteMember, listWorkspaces } from '../../../src/lib/workspace-api';
import { useAuth } from '../../../src/providers/auth-provider';

type Workspace = Awaited<ReturnType<typeof listWorkspaces>>[number];

export default function WorkspacesPage() {
  const auth = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!auth.accessToken) {
      return;
    }

    const rows = await listWorkspaces(auth.accessToken);
    setWorkspaces(rows);
    setSelectedWorkspaceId((current) => current ?? rows[0]?.id ?? null);
  }

  useEffect(() => {
    void load();
  }, [auth.accessToken]);

  async function submitWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as { name: string; slug: string };

    try {
      await createWorkspace(auth.accessToken as string, form);
      setMessage('Workspace created.');
      await load();
    } catch (caught) {
      setMessage(normalizeApiError(caught).message);
    }
  }

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedWorkspaceId) {
      setMessage('Select a workspace first.');
      return;
    }

    const form = Object.fromEntries(new FormData(event.currentTarget)) as {
      email: string;
      role: 'EDITOR' | 'REVIEWER' | 'VIEWER';
    };

    try {
      await inviteMember(auth.accessToken as string, selectedWorkspaceId, form);
      setMessage('Invitation sent.');
    } catch (caught) {
      setMessage(normalizeApiError(caught).message);
    }
  }

  if (auth.isInitializing) {
    return (
      <main className="workspace">
        <section className="panel panel-pad">Checking your session...</section>
      </main>
    );
  }

  if (!auth.accessToken) {
    return (
      <main className="workspace">
        <section className="panel panel-pad">
          <h1 className="section-title">Sign in required</h1>
          <p className="section-copy">Sign in to manage workspaces.</p>
          <Link href="/login?returnTo=%2Fworkspaces" className="ui-button ui-button-primary inline-action">
            <span className="ui-button-icon"><LogIn aria-hidden="true" /></span>
            <span>Sign in</span>
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="workspace">
      <div className="two-column">
        <section className="panel panel-pad">
          <h1 className="section-title">Workspaces</h1>
          <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                className="panel panel-pad"
                style={{ textAlign: 'start', cursor: 'pointer' }}
                onClick={() => setSelectedWorkspaceId(workspace.id)}
              >
                {workspace.name} - {workspace.role}
              </button>
            ))}
          </div>
        </section>
        <section className="panel panel-pad">
          <h2 className="section-title">Create workspace</h2>
          <form onSubmit={submitWorkspace} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <TextField id="name" name="name" label="Name" required />
            <TextField id="slug" name="slug" label="Slug" required />
            <Button type="submit" icon={<Plus aria-hidden="true" />}>Create</Button>
          </form>
          <h2 className="section-title" style={{ marginTop: 24 }}>Invite member</h2>
          <form onSubmit={submitInvite} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <TextField id="email" name="email" label="Email" type="email" required />
            <label className="field-stack">
              Role
              <select name="role" style={{ minHeight: 42, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <option value="EDITOR">Editor</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </label>
            <Button type="submit" icon={<Send aria-hidden="true" />}>Invite</Button>
          </form>
          {message ? <p role="status" className="section-copy">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
