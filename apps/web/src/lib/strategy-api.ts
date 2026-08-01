import { apiFetch } from './api-client';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type StrategyContentOrigin = 'AI' | 'USER' | 'IMPORTED';

export type StrategyRoot = {
  id: string;
  positioning: string | null;
  value_proposition: string | null;
  mission: string | null;
  vision: string | null;
  essence: string | null;
  promise: string | null;
  completion_percent: number;
  completion_reasons: string[];
  confirmed_at: string | null;
  lock_version: number;
};

export type StrategyTextItem = {
  id: string;
  text: string;
  legal_review_required?: boolean;
  origin: StrategyContentOrigin;
  sort_order: number;
};

export type StrategyPersona = {
  id: string;
  name: string;
  segment: string | null;
  needs: string[];
  pains: string[];
  origin: StrategyContentOrigin;
  sort_order: number;
};

export type StrategyPillar = {
  id: string;
  title: string;
  message: string;
  proof_points: string[];
  origin: StrategyContentOrigin;
  sort_order: number;
};

export type StrategyTagline = StrategyTextItem & {
  language_code: string;
  is_selected: boolean;
  legal_review_required: boolean;
};

export type StrategyAggregate = {
  strategy: StrategyRoot;
  values: StrategyTextItem[];
  personas: StrategyPersona[];
  messagingPillars: StrategyPillar[];
  taglines: StrategyTagline[];
  rules: StrategyTextItem[];
};

export type StrategyPayload = {
  lockVersion: number;
  positioning?: string;
  valueProposition?: string;
  mission?: string;
  vision?: string;
  essence?: string;
  promise?: string;
  values?: Array<{ id?: string; text: string; origin?: StrategyContentOrigin; sortOrder?: number }>;
  personas?: Array<{
    id?: string;
    name: string;
    segment?: string;
    needs?: string[];
    pains?: string[];
    origin?: StrategyContentOrigin;
    sortOrder?: number;
  }>;
  messagingPillars?: Array<{
    id?: string;
    title: string;
    message: string;
    proofPoints?: string[];
    origin?: StrategyContentOrigin;
    sortOrder?: number;
  }>;
  taglines?: Array<{
    id?: string;
    text: string;
    languageCode?: string;
    isSelected?: boolean;
    legalReviewRequired?: boolean;
    origin?: StrategyContentOrigin;
    sortOrder?: number;
  }>;
  rules?: Array<{ id?: string; text: string; legalReviewRequired?: boolean; origin?: StrategyContentOrigin; sortOrder?: number }>;
};

export function getStrategy(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<StrategyAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/strategy`,
    { headers: authHeaders(accessToken) }
  );
}

export function updateStrategy(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  input: StrategyPayload
) {
  return apiFetch<StrategyAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/strategy`,
    {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify(input)
    }
  );
}

export function completeStrategy(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  lockVersion: number
) {
  return apiFetch<StrategyAggregate>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/strategy/complete`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ lockVersion })
    }
  );
}
