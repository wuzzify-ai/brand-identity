'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthFormShell } from '../../../src/components/auth/auth-form-shell';
import { Button } from '../../../src/components/ui/button';
import { normalizeApiError } from '../../../src/lib/api-client';
import * as authApi from '../../../src/lib/auth-api';

function VerifyEmailContent() {
  const token = useSearchParams().get('token');
  const [message, setMessage] = useState('Verifying email...');

  useEffect(() => {
    if (!token) {
      setMessage('Verification link is missing a token.');
      return;
    }

    void authApi
      .verifyEmail(token)
      .then((response) => setMessage(response.message ?? 'Email verified.'))
      .catch((error) => setMessage(normalizeApiError(error).message));
  }, [token]);

  return (
    <AuthFormShell title="Email verification" description={message}>
      <Link href="/login"><Button type="button">Go to login</Button></Link>
    </AuthFormShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthFormShell title="Email verification" description="Loading verification..." />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
