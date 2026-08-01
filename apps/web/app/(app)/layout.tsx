import Link from 'next/link';
import { WorkspaceNav } from '../../src/components/nav/workspace-nav';

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/dashboard" className="topbar-title">
            <span className="brand-mark">B</span>
            <span>Brand workspace</span>
          </Link>
          <WorkspaceNav />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
