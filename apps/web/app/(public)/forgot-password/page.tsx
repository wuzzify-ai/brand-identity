'use client';

import { useState } from 'react';
import { z } from 'zod';
import { AuthFormShell } from '../../../src/components/auth/auth-form-shell';
import { Button } from '../../../src/components/ui/button';
import { TextField } from '../../../src/components/ui/form';
import { normalizeApiError } from '../../../src/lib/api-client';
import * as authApi from '../../../src/lib/auth-api';

const schema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setError('Enter a valid email.');
      return;
    }

    try {
      const response = await authApi.forgotPassword(parsed.data.email);
      setMessage(response.message ?? 'Check your email for reset instructions.');
      setError(null);
    } catch (caught) {
      setError(normalizeApiError(caught).message);
    }
  }

  return (
    <AuthFormShell title="Reset password" description="Request a password reset link.">
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <TextField id="email" name="email" label="Email" type="email" required />
        {error ? <p role="alert" style={{ color: 'var(--color-coral)', margin: 0 }}>{error}</p> : null}
        {message ? <p role="status" className="section-copy">{message}</p> : null}
        <Button type="submit">Send reset link</Button>
      </form>
    </AuthFormShell>
  );
}
