'use client';

import Link from 'next/link';
import { useState } from 'react';
import { z } from 'zod';
import { AuthFormShell } from '../../../src/components/auth/auth-form-shell';
import { Button } from '../../../src/components/ui/button';
import { TextField } from '../../../src/components/ui/form';
import * as authApi from '../../../src/lib/auth-api';
import { normalizeApiError } from '../../../src/lib/api-client';

const registerSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  displayName: z.string().trim().min(1, 'Display name is required.').max(180, 'Display name is too long.'),
  password: z.string().min(12, 'Password must be at least 12 characters.').max(256, 'Password is too long.'),
  workspaceName: z.string().trim().min(1, 'Workspace name is required.').max(180, 'Workspace name is too long.'),
  workspaceSlug: z
    .string()
    .trim()
    .min(3, 'Workspace slug must be at least 3 characters.')
    .max(200, 'Workspace slug is too long.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens only.')
});

type RegisterFieldErrors = Partial<Record<keyof z.infer<typeof registerSchema>, string>>;

export default function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse(Object.fromEntries(form));

    if (!parsed.success) {
      setPending(false);
      const nextFieldErrors: RegisterFieldErrors = {};

      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0];

        if (typeof fieldName === 'string' && fieldName in registerSchema.shape) {
          nextFieldErrors[fieldName as keyof RegisterFieldErrors] = issue.message;
        }
      }

      setFieldErrors(nextFieldErrors);
      setError('Fix the highlighted fields, then try again.');
      return;
    }

    try {
      const response = await authApi.register(parsed.data);
      setMessage(response.message ?? 'Check your email to verify the account.');
    } catch (caught) {
      setError(normalizeApiError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFormShell title="Create account" description="Start a secure workspace for generated brand identities.">
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <TextField id="email" name="email" label="Email" type="email" autoComplete="email" error={fieldErrors.email} required />
        <TextField id="displayName" name="displayName" label="Display name" autoComplete="name" error={fieldErrors.displayName} required />
        <TextField
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password}
          required
        />
        <TextField id="workspaceName" name="workspaceName" label="Workspace name" error={fieldErrors.workspaceName} required />
        <TextField
          id="workspaceSlug"
          name="workspaceSlug"
          label="Workspace slug"
          placeholder="my-workspace"
          error={fieldErrors.workspaceSlug}
          required
        />
        {error ? <p role="alert" style={{ color: 'var(--color-coral)', margin: 0 }}>{error}</p> : null}
        {message ? <p role="status" className="section-copy">{message}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? 'Creating...' : 'Create account'}</Button>
        <Link href="/login" className="section-copy">Already have an account?</Link>
      </form>
    </AuthFormShell>
  );
}
