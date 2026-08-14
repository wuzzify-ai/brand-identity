"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../providers/auth-provider";

function loginHref(pathname: string | null) {
  return pathname
    ? `/login?returnTo=${encodeURIComponent(pathname)}`
    : "/login";
}

export function WorkspaceNav() {
  const auth = useAuth();
  const pathname = usePathname();

  function current(path: string) {
    return pathname === path || pathname?.startsWith(`${path}/`)
      ? ("page" as const)
      : undefined;
  }

  return (
    <nav className="topbar-nav" aria-label="Workspace navigation">
      <Link
        href="/brand-identities/new"
        aria-current={pathname === "/brand-identities/new" ? "page" : undefined}
      >
        New identity
      </Link>
      <Link
        href="/brand-identities"
        aria-current={
          pathname !== "/brand-identities/new"
            ? current("/brand-identities")
            : undefined
        }
      >
        Identities
      </Link>
      <Link href="/workspaces" aria-current={current("/workspaces")}>
        Workspaces
      </Link>
      {auth.isAuthenticated ? (
        <Link href="/account" aria-current={current("/account")}>
          Account
        </Link>
      ) : null}
      <Link href="/rtl" aria-current={current("/rtl")}>
        RTL preview
      </Link>
      {!auth.isAuthenticated && !auth.isInitializing ? (
        <Link href={loginHref(pathname)} className="topbar-action">
          <LogIn aria-hidden="true" />
          <span>Sign in</span>
        </Link>
      ) : null}
    </nav>
  );
}
