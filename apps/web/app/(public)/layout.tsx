import Link from 'next/link';

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="topbar-title">
            <span className="brand-mark">B</span>
            <span>Brand Identity Creator</span>
          </Link>
          <nav className="topbar-nav" aria-label="Public navigation">
            <Link href="/register">Register</Link>
            <Link href="/login">Login</Link>
            <Link href="/dashboard">Workspace</Link>
            <Link href="/rtl">RTL preview</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
