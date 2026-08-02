'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { z } from 'zod';
import { AuthFormShell } from '../../../src/components/auth/auth-form-shell';
import { Button } from '../../../src/components/ui/button';
import { TextField } from '../../../src/components/ui/form';
import { normalizeApiError } from '../../../src/lib/api-client';
import { useAuth } from '../../../src/providers/auth-provider';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().optional()
});

function safeReturnPath(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const registrationCompleted = searchParams.get('registered') === '1';
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));

    if (!parsed.success) {
      setPending(false);
      setError('Check the fields and try again.');
      return;
    }

    try {
      const input: { email: string; password: string; deviceName?: string } = {
        email: parsed.data.email,
        password: parsed.data.password
      };

      if (parsed.data.deviceName) {
        input.deviceName = parsed.data.deviceName;
      }

      await auth.login(input);
      router.push(safeReturnPath(searchParams.get('returnTo')));
    } catch (caught) {
      setError(normalizeApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFormShell title="Sign in" description="Continue to your brand identity workspace.">
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <TextField id="email" name="email" label="Email" type="email" autoComplete="email" required />
        <TextField id="password" name="password" label="Password" type="password" autoComplete="current-password" required />
        <TextField id="deviceName" name="deviceName" label="Device name" placeholder="Work laptop" />
        {error ? <p role="alert" style={{ color: 'var(--color-coral)', margin: 0 }}>{error}</p> : null}
        {registrationCompleted ? <p role="status" className="section-copy">Account created. You can sign in.</p> : null}
        <Button type="submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</Button>
        <Link href="/forgot-password" className="section-copy">Forgot password?</Link>
      </form>
    </AuthFormShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormShell title="Sign in" description="Loading sign in..." />}>
      <LoginContent />
    </Suspense>
  );
}
