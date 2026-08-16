'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '../../../../src/components/ui/button';
import { TextAreaField, TextField } from '../../../../src/components/ui/form';
import { normalizeApiError } from '../../../../src/lib/api-client';
import { createIdentityProject } from '../../../../src/lib/identity-api';
import { listWorkspaces } from '../../../../src/lib/workspace-api';
import { useAuth } from '../../../../src/providers/auth-provider';

const schema = z.object({
  name: z.string().min(1).max(180),
  slug: z.string().optional(),
  initialDescription: z.string().optional(),
  intent: z.enum(['ai', 'manual']).default('manual')
});

export default function NewBrandIdentityPage() {
  const auth = useAuth();
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [initialDescription, setInitialDescription] = useState('');

  useEffect(() => {
    setInitialDescription(new URLSearchParams(window.location.search).get('initialDescription') ?? '');
  }, []);

  useEffect(() => {
    if (!auth.accessToken) {
      return;
    }

    void listWorkspaces(auth.accessToken).then((workspaces) => setWorkspaceId(workspaces[0]?.id ?? null));
  }, [auth.accessToken]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth.accessToken || !workspaceId) {
      setMessage('Create or select a workspace first.');
      return;
    }

    const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setMessage('Check the project fields.');
      return;
    }

    try {
      const input: { name: string; slug?: string; initialDescription?: string } = {
        name: parsed.data.name
      };

      if (parsed.data.slug) {
        input.slug = parsed.data.slug;
      }

      if (parsed.data.initialDescription) {
        input.initialDescription = parsed.data.initialDescription;
      }

      const response = await createIdentityProject(auth.accessToken, workspaceId, input);
      const nextParams = new URLSearchParams({ workspaceId, step: 'BRIEF' });

      if (parsed.data.intent === 'ai') {
        nextParams.set('autoBuild', 'brief');
      }

      router.push(`/brand-identities/${response.project.id}?${nextParams.toString()}`);
    } catch (caught) {
      setMessage(normalizeApiError(caught).message);
    }
  }

  return (
    <main className="workspace">
      <section className="panel panel-pad">
        <h1 className="section-title">New brand identity</h1>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          <TextField id="name" name="name" label="Project name" required />
          <TextField id="slug" name="slug" label="Slug" />
          <TextAreaField
            id="initialDescription"
            name="initialDescription"
            label="Business description"
            value={initialDescription}
            onChange={(event) => setInitialDescription(event.target.value)}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button type="submit" name="intent" value="ai">Build my brief</Button>
            <Button type="submit" name="intent" value="manual" variant="secondary">Start manually</Button>
          </div>
          {message ? <p role="status" className="section-copy">{message}</p> : null}
        </form>
      </section>
    </main>
  );
}
