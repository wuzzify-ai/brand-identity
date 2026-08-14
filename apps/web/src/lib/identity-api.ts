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

export type AiEmployeeActivityItem = {
  id: string;
  workflow_stage_key: WorkflowStageSummary['stage_key'];
  task: string;
  tier: string;
  status: string;
  progress_percent: number;
  progress_message: string | null;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
  latest_run_status: string | null;
  latest_model: string | null;
  latest_provider: string | null;
  total_tokens: number;
  artifact_count: number;
  artifact_names: string[];
};

export type AiEmployeeHandoffItem = {
  id: string;
  identity_version_id: string;
  generation_job_id: string | null;
  from_stage_key: WorkflowStageSummary['stage_key'];
  to_stage_key: WorkflowStageSummary['stage_key'] | null;
  task: string;
  employee_role: string;
  summary: string;
  notes: string[];
  recommendations: string[];
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type StageReadinessItem = {
  stage_key: WorkflowStageSummary['stage_key'];
  employee_role: string;
  status: 'READY' | 'BLOCKED' | 'NEEDS_INPUT' | 'IN_PROGRESS' | 'COMPLETE';
  summary: string;
  reasons: string[];
  recommended_actions: string[];
  actions: StageReadinessAction[];
};

export type StageReadinessAction = {
  code:
    | 'NAVIGATE_STAGE'
    | 'REFRESH_READINESS'
    | 'RUN_COMPETITOR_RESEARCH'
    | 'RUN_STRATEGY_GENERATION'
    | 'RUN_VISUAL_DIRECTIONS'
    | 'RUN_LOGO_CONCEPTS'
    | 'RUN_BRAND_BOOK';
  label: string;
  stage_key: WorkflowStageSummary['stage_key'];
  style: 'primary' | 'secondary';
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

export function getIdentityVersionActivity(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<AiEmployeeActivityItem[]>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/activity`,
    {
      headers: authHeaders(accessToken)
    }
  );
}

export function getIdentityVersionHandoffs(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<AiEmployeeHandoffItem[]>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/handoffs`,
    {
      headers: authHeaders(accessToken)
    }
  );
}

export function getIdentityVersionReadiness(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<StageReadinessItem[]>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/readiness`,
    {
      headers: authHeaders(accessToken)
    }
  );
}
