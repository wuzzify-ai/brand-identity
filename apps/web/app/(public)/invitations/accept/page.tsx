'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthFormShell } from '../../../../src/components/auth/auth-form-shell';
import { Button } from '../../../../src/components/ui/button';
import { normalizeApiError } from '../../../../src/lib/api-client';
import { acceptInvitation } from '../../../../src/lib/workspace-api';
import { useAuth } from '../../../../src/providers/auth-provider';

function AcceptInvitationContent() {
  const token = useSearchParams().get('token');
  const auth = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  async function accept() {
    if (!auth.accessToken) {
      setMessage('Sign in before accepting this invitation.');
      return;
    }

    if (!token) {
      setMessage('Invitation token is missing.');
      return;
    }

    try {
      await acceptInvitation(auth.accessToken, token);
      setMessage('Invitation accepted.');
    } catch (caught) {
      setMessage(normalizeApiError(caught).message);
    }
  }

  return (
    <AuthFormShell title="Workspace invitation" description={message ?? 'Accept an invitation to join a workspace.'}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button type="button" onClick={accept}>Accept invitation</Button>
        <Link href="/login"><Button type="button" variant="secondary">Sign in</Button></Link>
      </div>
    </AuthFormShell>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<AuthFormShell title="Workspace invitation" description="Loading invitation..." />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
