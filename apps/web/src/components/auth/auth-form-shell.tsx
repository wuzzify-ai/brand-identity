import type { ReactNode } from "react";

type AuthFormShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function AuthFormShell({
  title,
  description,
  children,
}: AuthFormShellProps) {
  return (
    <div className="workspace">
      <section
        className="panel panel-pad auth-panel"
        style={{ maxWidth: 560, margin: "0 auto" }}
      >
        <h1 className="section-title">{title}</h1>
        <p className="section-copy">{description}</p>
        <div style={{ marginTop: 20 }}>{children}</div>
      </section>
    </div>
  );
}
