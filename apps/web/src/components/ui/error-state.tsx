import { AlertTriangle } from 'lucide-react';
import { normalizeApiError } from '../../lib/api-client';

export function ErrorState({ error }: Readonly<{ error: unknown }>) {
  const normalized = normalizeApiError(error);

  return (
    <section className="panel panel-pad" role="alert">
      <AlertTriangle aria-hidden="true" />
      <h2 className="section-title">{normalized.message}</h2>
      <p className="section-copy">Request ID: {normalized.requestId ?? 'not available'}</p>
    </section>
  );
}
