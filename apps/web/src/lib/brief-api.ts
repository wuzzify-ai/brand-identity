import { apiFetch } from './api-client';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type BriefContentOrigin = 'AI' | 'USER' | 'IMPORTED';

export type BriefRoot = {
  id: string;
  identity_version_id: string;
  industry: string | null;
  positioning: string | null;
  completion_percent: number;
  completion_reasons: string[];
  confirmed_at: string | null;
  lock_version: number;
};

export type BriefLanguage = {
  id: string;
  language_code: string;
  display_name: string;
  is_primary: boolean;
  origin: BriefContentOrigin;
  sort_order: number;
};

export type BriefNamedItem = {
  id: string;
  name: string;
  description: string | null;
  origin: BriefContentOrigin;
  sort_order: number;
};

export type BriefMarket = {
  id: string;
  name: string;
  region: string | null;
  origin: BriefContentOrigin;
  sort_order: number;
};

export type BriefTextItem = {
  id: string;
  text: string;
  origin: BriefContentOrigin;
  sort_order: number;
};

export type BriefAggregate = {
  brief: BriefRoot;
  languages: BriefLanguage[];
  audiences: BriefNamedItem[];
  markets: BriefMarket[];
  offerings: BriefNamedItem[];
  preferences: BriefTextItem[];
  constraints: BriefTextItem[];
};

export type BriefFormPayload = {
  lockVersion: number;
  industry?: string;
  positioning?: string;
  languages?: Array<{
    id?: string;
    languageCode: string;
    displayName: string;
    isPrimary?: boolean;
    origin?: BriefContentOrigin;
    sortOrder?: number;
  }>;
  audiences?: Array<{ id?: string; name: string; description?: string; origin?: BriefContentOrigin; sortOrder?: number }>;
  markets?: Array<{ id?: string; name: string; region?: string; origin?: BriefContentOrigin; sortOrder?: number }>;
  offerings?: Array<{ id?: string; name: string; description?: string; origin?: BriefContentOrigin; sortOrder?: number }>;
  preferences?: Array<{ id?: string; text: string; origin?: BriefContentOrigin; sortOrder?: number }>;
  constraints?: Array<{ id?: string; text: string; origin?: BriefContentOrigin; sortOrder?: number }>;
};

export function getBrief(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<BriefAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brief`,
    {
      headers: authHeaders(accessToken)
    }
  );
}

export function updateBrief(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  input: BriefFormPayload
) {
  return apiFetch<BriefAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brief`,
    {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify(input)
    }
  );
}

export function completeBrief(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  lockVersion: number
) {
  return apiFetch<BriefAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brief/complete`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ lockVersion })
    }
  );
}
