import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
};

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <section className="panel panel-pad" aria-labelledby="empty-title">
      {icon}
      <h1 id="empty-title" className="section-title">
        {title}
      </h1>
      <p className="section-copy">{description}</p>
    </section>
  );
}
