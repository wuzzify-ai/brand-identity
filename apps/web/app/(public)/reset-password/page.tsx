'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { z } from 'zod';
import { AuthFormShell } from '../../../src/components/auth/auth-form-shell';
import { Button } from '../../../src/components/ui/button';
import { TextField } from '../../../src/components/ui/form';
import { normalizeApiError } from '../../../src/lib/api-client';
import * as authApi from '../../../src/lib/auth-api';

const schema = z.object({ newPassword: z.string().min(12).max(256) });

function ResetPasswordContent() {
  const token = useSearchParams().get('token');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!token) {
      setError('Reset token is missing.');
      return;
    }

    if (!parsed.success) {
      setError('Password must be at least 12 characters.');
      return;
    }

    try {
      const response = await authApi.resetPassword({ token, newPassword: parsed.data.newPassword });
      setMessage(response.message ?? 'Password was reset.');
      setError(null);
    } catch (caught) {
      setError(normalizeApiError(caught).message);
    }
  }

  return (
    <AuthFormShell title="Set new password" description="Choose a new password for your account.">
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <TextField id="newPassword" name="newPassword" label="New password" type="password" required />
        {error ? <p role="alert" style={{ color: 'var(--color-coral)', margin: 0 }}>{error}</p> : null}
        {message ? <p role="status" className="section-copy">{message} <Link href="/login">Sign in</Link></p> : null}
        <Button type="submit">Reset password</Button>
      </form>
    </AuthFormShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthFormShell title="Set new password" description="Loading reset form..." />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
