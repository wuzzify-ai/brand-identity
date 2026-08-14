import Link from "next/link";
import { WuzzifyBrand } from "../../src/components/brand/wuzzify-brand";
import { WorkspaceNav } from "../../src/components/nav/workspace-nav";

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/dashboard" className="topbar-title">
            <WuzzifyBrand product="Brand Studio" />
          </Link>
          <WorkspaceNav />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
