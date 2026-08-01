'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { normalizeApiError } from '../../lib/api-client';
import { createIdentityProject } from '../../lib/identity-api';
import { listWorkspaces } from '../../lib/workspace-api';
import { useAuth } from '../../providers/auth-provider';
import { Button } from '../ui/button';
import { TextAreaField } from '../ui/form';

function createDraftName(description: string): string {
  const firstUsefulLine = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstUsefulLine) {
    return 'Untitled brand identity';
  }

  return firstUsefulLine.length > 80 ? `${firstUsefulLine.slice(0, 77)}...` : firstUsefulLine;
}

function newIdentityReturnPath(description: string): string {
  const params = new URLSearchParams();

  if (description) {
    params.set('initialDescription', description);
  }

  return `/brand-identities/new${params.toString() ? `?${params.toString()}` : ''}`;
}

export function LaunchPanel() {
  const auth = useAuth();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function resolveAccessToken(): Promise<string | null> {
    if (auth.accessToken) {
      return auth.accessToken;
    }

    try {
      return await auth.refresh();
    } catch {
      return null;
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
      setMessage('Describe the business first, then I can start the draft.');
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const accessToken = await resolveAccessToken();
      const returnTo = newIdentityReturnPath(trimmedDescription);

      if (!accessToken) {
        router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      const workspaces = await listWorkspaces(accessToken);
      const workspaceId = workspaces[0]?.id;

      if (!workspaceId) {
        setMessage('Create a workspace first. I saved your description in the next screen.');
        router.push(returnTo);
        return;
      }

      const response = await createIdentityProject(accessToken, workspaceId, {
        name: createDraftName(trimmedDescription),
        initialDescription: trimmedDescription
      });

      router.push(`/brand-identities/${response.project.id}?workspaceId=${workspaceId}`);
    } catch (caught) {
      setMessage(normalizeApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, margin: '20px 0' }}>
      <TextAreaField
        id="business-description"
        label="Business description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Example: A bilingual premium coffee roaster in Cairo serving founders, designers, and remote teams."
      />
      <div>
        <Button
          type="submit"
          disabled={pending}
          icon={<ArrowRight aria-hidden="true" />}
          iconPosition="right"
        >
          {pending ? 'Starting draft...' : 'Start draft'}
        </Button>
      </div>
      {message ? <p role="status" className="section-copy">{message}</p> : null}
    </form>
  );
}
