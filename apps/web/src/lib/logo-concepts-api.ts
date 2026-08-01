import { apiFetch } from './api-client';
import type { BrandAsset } from './assets-api';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type LogoConcept = {
  id: string;
  type: string;
  status: string;
  review_status: string;
  name: string;
  rationale: string;
  language_codes: string[];
  prompt: string;
  production_notes: string | null;
  review_warnings: string[];
  metadata: Record<string, unknown>;
  lock_version: number;
};

export type LogoConceptAggregate = {
  concept: LogoConcept;
  assets: BrandAsset[];
};

export type LogoConceptListItem = LogoConcept & {
  assets: BrandAsset[];
};

export function listLogoConcepts(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<LogoConceptListItem[]>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/logo-concepts`, {
    headers: authHeaders(accessToken)
  });
}

export function updateLogoConcept(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  conceptId: string,
  input: { lockVersion: number; productionNotes?: string }
) {
  return apiFetch<LogoConceptAggregate>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/logo-concepts/${conceptId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input)
  });
}

export function runLogoConceptAction(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  conceptId: string,
  action: 'shortlist' | 'select' | 'reject',
  lockVersion: number
) {
  return apiFetch<LogoConceptAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/logo-concepts/${conceptId}/${action}`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ lockVersion })
    }
  );
}
