'use client';

import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../providers/auth-provider';

function loginHref(pathname: string | null) {
  return pathname ? `/login?returnTo=${encodeURIComponent(pathname)}` : '/login';
}

export function WorkspaceNav() {
  const auth = useAuth();
  const pathname = usePathname();

  return (
    <nav className="topbar-nav" aria-label="Workspace navigation">
      <Link href="/brand-identities/new">New identity</Link>
      <Link href="/brand-identities">Identities</Link>
      <Link href="/workspaces">Workspaces</Link>
      {auth.isAuthenticated ? <Link href="/account">Account</Link> : null}
      <Link href="/rtl">RTL preview</Link>
      {!auth.isAuthenticated && !auth.isInitializing ? (
        <Link href={loginHref(pathname)} className="topbar-action">
          <LogIn aria-hidden="true" />
          <span>Sign in</span>
        </Link>
      ) : null}
    </nav>
  );
}
