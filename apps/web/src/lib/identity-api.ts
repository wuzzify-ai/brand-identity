import { apiFetch } from './api-client';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type IdentityProject = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  metadata?: {
    initialDescription?: string | null;
  } | null;
  lock_version: number;
  updated_at: string;
};

export type WorkflowStageSummary = {
  stage_key: 'BRIEF' | 'STRATEGY' | 'VISUALS' | 'ASSETS' | 'FINALIZE';
  status: string;
  completion_percent: number;
  stale_reason: string | null;
};

export function listIdentityProjects(accessToken: string, workspaceId: string) {
  return apiFetch<IdentityProject[]>(`/workspaces/${workspaceId}/brand-identities`, {
    headers: authHeaders(accessToken)
  });
}

export function createIdentityProject(
  accessToken: string,
  workspaceId: string,
  input: { name: string; slug?: string; initialDescription?: string }
) {
  return apiFetch<{ project: IdentityProject; version: { id: string }; stages: WorkflowStageSummary[] }>(
    `/workspaces/${workspaceId}/brand-identities`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(input)
    }
  );
}

export function getIdentityProject(accessToken: string, workspaceId: string, projectId: string) {
  return apiFetch<IdentityProject>(`/workspaces/${workspaceId}/brand-identities/${projectId}`, {
    headers: authHeaders(accessToken)
  });
}

export function listIdentityVersions(accessToken: string, workspaceId: string, projectId: string) {
  return apiFetch<{ id: string; version_number: number; status: string; stages: WorkflowStageSummary[] }[]>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions`,
    {
      headers: authHeaders(accessToken)
    }
  );
}
