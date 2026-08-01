import { apiFetch } from './api-client';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type VisualDirection = {
  id: string;
  name: string;
  rationale: string | null;
  mood_keywords: string[];
  imagery: string[];
  layout_notes: string[];
  is_selected: boolean;
  lock_version: number;
  origin: 'AI' | 'USER' | 'IMPORTED';
};

export type VisualColor = {
  id: string;
  token_name: string;
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  usage: string | null;
  contrast_on_white: string | number;
  contrast_on_black: string | number;
};

export type VisualFont = {
  id: string;
  role: string;
  family: string;
  fallback: string;
  weights: number[];
  supported_scripts: string[];
  source: string;
  license_status: string;
};

export type VisualDirectionAggregate = {
  direction: VisualDirection;
  colors: VisualColor[];
  fonts: VisualFont[];
};

export type VisualDirectionPayload = {
  identityVersionId: string;
  lockVersion?: number;
  name: string;
  rationale?: string;
  moodKeywords?: string[];
  imagery?: string[];
  layoutNotes?: string[];
  colors?: Array<{ id?: string; tokenName: string; name: string; hex: string; usage?: string; sortOrder?: number }>;
  fonts?: Array<{
    id?: string;
    role: string;
    family: string;
    fallback: string;
    weights?: number[];
    supportedScripts?: string[];
    source?: string;
    licenseStatus?: string;
    sortOrder?: number;
  }>;
};

export function listVisualDirections(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<VisualDirection[]>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/visual-directions`,
    { headers: authHeaders(accessToken) }
  );
}

export function getVisualDirection(accessToken: string, workspaceId: string, projectId: string, versionId: string, directionId: string) {
  return apiFetch<VisualDirectionAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/visual-directions/${directionId}`,
    { headers: authHeaders(accessToken) }
  );
}

export function createVisualDirection(accessToken: string, workspaceId: string, projectId: string, versionId: string, input: VisualDirectionPayload) {
  return apiFetch<VisualDirectionAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/visual-directions`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(input)
    }
  );
}

export function updateVisualDirection(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  directionId: string,
  input: VisualDirectionPayload & { lockVersion: number }
) {
  return apiFetch<VisualDirectionAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/visual-directions/${directionId}`,
    {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify(input)
    }
  );
}

export function selectVisualDirection(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  directionId: string,
  lockVersion: number
) {
  return apiFetch<VisualDirectionAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/visual-directions/${directionId}/select`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ lockVersion })
    }
  );
}

export function archiveVisualDirection(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  directionId: string,
  lockVersion: number
) {
  return apiFetch<{ ok: true }>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/visual-directions/${directionId}?lockVersion=${lockVersion}`,
    { method: 'DELETE', headers: authHeaders(accessToken) }
  );
}
