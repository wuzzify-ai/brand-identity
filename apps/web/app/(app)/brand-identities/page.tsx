'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../src/components/ui/button';
import { EmptyState } from '../../../src/components/ui/empty-state';
import { ErrorState } from '../../../src/components/ui/error-state';
import { Skeleton } from '../../../src/components/ui/skeleton';
import { listIdentityProjects, type IdentityProject } from '../../../src/lib/identity-api';
import { listWorkspaces } from '../../../src/lib/workspace-api';
import { useAuth } from '../../../src/providers/auth-provider';

export default function BrandIdentitiesPage() {
  const auth = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [projects, setProjects] = useState<IdentityProject[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!auth.accessToken) {
      return;
    }

    void listWorkspaces(auth.accessToken)
      .then((workspaces) => {
        const firstWorkspaceId = workspaces[0]?.id ?? null;
        setWorkspaceId(firstWorkspaceId);
        return firstWorkspaceId ? listIdentityProjects(auth.accessToken as string, firstWorkspaceId) : [];
      })
      .then(setProjects)
      .catch(setError);
  }, [auth.accessToken]);

  if (!auth.accessToken) {
    return <main className="workspace"><ErrorState error={new Error('Sign in to view brand identities.')} /></main>;
  }

  return (
    <main className="workspace">
      <section className="panel panel-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h1 className="section-title">Brand identities</h1>
            <p className="section-copy">Create and manage staged identity projects.</p>
          </div>
          <Link href="/brand-identities/new"><Button type="button" icon={<Plus aria-hidden="true" />}>New</Button></Link>
        </div>
        {error ? <ErrorState error={error} /> : null}
        {!projects ? <Skeleton /> : null}
        {projects?.length === 0 ? (
          <EmptyState title="No identities yet" description="Create a project to start with the Brief stage." />
        ) : null}
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {projects?.map((project) => (
            <Link key={project.id} href={`/brand-identities/${project.id}?workspaceId=${workspaceId ?? ''}`} className="panel panel-pad">
              <h2 style={{ margin: 0, fontSize: 18 }}>{project.name}</h2>
              <p className="section-copy">{project.slug ?? project.id}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
