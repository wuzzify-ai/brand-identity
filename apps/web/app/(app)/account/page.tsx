'use client';

import { useEffect, useState } from 'react';
import { LogOut, ShieldX } from 'lucide-react';
import { Button } from '../../../src/components/ui/button';
import { ErrorState } from '../../../src/components/ui/error-state';
import { Skeleton } from '../../../src/components/ui/skeleton';
import { listSessions, revokeSession } from '../../../src/lib/workspace-api';
import { useAuth } from '../../../src/providers/auth-provider';

type Session = Awaited<ReturnType<typeof listSessions>>[number];

export default function AccountPage() {
  const auth = useAuth();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function load() {
    if (!auth.accessToken) {
      return;
    }

    try {
      setSessions(await listSessions(auth.accessToken));
    } catch (caught) {
      setError(caught);
    }
  }

  useEffect(() => {
    void load();
  }, [auth.accessToken]);

  if (!auth.accessToken) {
    return <main className="workspace"><ErrorState error={new Error('Sign in to manage your account.')} /></main>;
  }

  return (
    <main className="workspace">
      <section className="panel panel-pad">
        <h1 className="section-title">Account sessions</h1>
        <p className="section-copy">Review signed-in devices and revoke old sessions.</p>
        {error ? <ErrorState error={error} /> : null}
        {!sessions ? <Skeleton /> : null}
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {sessions?.map((session) => (
            <article key={session.id} className="panel panel-pad">
              <h2 style={{ margin: 0, fontSize: 16 }}>{session.deviceName ?? 'Unknown device'}</h2>
              <p className="section-copy">{session.current ? 'Current session' : session.userAgent ?? 'No user agent'}</p>
              <Button
                type="button"
                variant="secondary"
                icon={<ShieldX aria-hidden="true" />}
                disabled={session.current}
                onClick={async () => {
                  await revokeSession(auth.accessToken as string, session.id);
                  await load();
                }}
              >
                Revoke
              </Button>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <Button type="button" icon={<LogOut aria-hidden="true" />} onClick={() => void auth.logout()}>
            Logout
          </Button>
        </div>
      </section>
    </main>
  );
}
