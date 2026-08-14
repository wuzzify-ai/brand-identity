import { apiFetch } from './api-client';
import type { StageReadinessAction, WorkflowStageSummary } from './identity-api';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type AiEmployeeAutopilotRun = {
  id: string;
  workspace_id: string;
  identity_project_id: string;
  identity_version_id: string;
  started_by_user_id: string | null;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  current_stage_key: WorkflowStageSummary['stage_key'] | null;
  last_action_code: StageReadinessAction['code'] | string | null;
  completed_steps: number;
  pause_reason: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  paused_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiEmployeeAutopilotEvent = {
  id: string;
  autopilot_run_id: string;
  generation_job_id: string | null;
  event_type: 'STARTED' | 'ACTION_STARTED' | 'ACTION_SUCCEEDED' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stage_key: WorkflowStageSummary['stage_key'] | null;
  action_code: StageReadinessAction['code'] | string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AiEmployeeAutopilotState = {
  run: AiEmployeeAutopilotRun | null;
  events: AiEmployeeAutopilotEvent[];
};

export type AiEmployeeAutopilotHistoryItem = AiEmployeeAutopilotRun & {
  event_count: number;
  latest_event_type: string | null;
  latest_event_message: string | null;
  latest_event_at: string | null;
};

export type AiEmployeeAutopilotAdvanceResult = AiEmployeeAutopilotState & {
  status: 'JOB_STARTED' | 'WAITING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  message: string;
  generationJobId?: string;
};

function autopilotPath(workspaceId: string, projectId: string, versionId: string) {
  return `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/autopilot`;
}

export function getCurrentAutopilotRun(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<AiEmployeeAutopilotState>(`${autopilotPath(workspaceId, projectId, versionId)}/current`, {
    headers: authHeaders(accessToken)
  });
}

export function getAutopilotHistory(accessToken: string, workspaceId: string, projectId: string, versionId: string, limit = 10) {
  return apiFetch<{ runs: AiEmployeeAutopilotHistoryItem[] }>(
    `${autopilotPath(workspaceId, projectId, versionId)}/history?limit=${limit}`,
    {
      headers: authHeaders(accessToken)
    }
  );
}

export function startAutopilotRun(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<AiEmployeeAutopilotState>(`${autopilotPath(workspaceId, projectId, versionId)}/start`, {
    method: 'POST',
    headers: authHeaders(accessToken)
  });
}

export function advanceAutopilotRun(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<AiEmployeeAutopilotAdvanceResult>(`${autopilotPath(workspaceId, projectId, versionId)}/advance`, {
    method: 'POST',
    headers: authHeaders(accessToken)
  });
}

export function appendAutopilotEvent(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  runId: string,
  input: {
    eventType: 'ACTION_STARTED' | 'ACTION_SUCCEEDED' | 'PAUSED' | 'COMPLETED' | 'FAILED';
    stageKey?: WorkflowStageSummary['stage_key'];
    actionCode?: StageReadinessAction['code'];
    message: string;
    generationJobId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  return apiFetch<AiEmployeeAutopilotState>(`${autopilotPath(workspaceId, projectId, versionId)}/runs/${runId}/events`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input)
  });
}

export function pauseAutopilotRun(accessToken: string, workspaceId: string, projectId: string, versionId: string, runId: string, reason: string) {
  return apiFetch<AiEmployeeAutopilotState>(`${autopilotPath(workspaceId, projectId, versionId)}/runs/${runId}/pause`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reason })
  });
}

export function completeAutopilotRun(accessToken: string, workspaceId: string, projectId: string, versionId: string, runId: string, reason: string) {
  return apiFetch<AiEmployeeAutopilotState>(`${autopilotPath(workspaceId, projectId, versionId)}/runs/${runId}/complete`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reason })
  });
}

export function failAutopilotRun(accessToken: string, workspaceId: string, projectId: string, versionId: string, runId: string, errorMessage: string) {
  return apiFetch<AiEmployeeAutopilotState>(`${autopilotPath(workspaceId, projectId, versionId)}/runs/${runId}/fail`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ errorMessage })
  });
}

export function cancelAutopilotRun(accessToken: string, workspaceId: string, projectId: string, versionId: string, runId: string, reason: string) {
  return apiFetch<AiEmployeeAutopilotState>(`${autopilotPath(workspaceId, projectId, versionId)}/runs/${runId}/cancel`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ reason })
  });
}

export function retryAutopilotRun(accessToken: string, workspaceId: string, projectId: string, versionId: string, runId: string) {
  return apiFetch<AiEmployeeAutopilotState>(`${autopilotPath(workspaceId, projectId, versionId)}/runs/${runId}/retry`, {
    method: 'POST',
    headers: authHeaders(accessToken)
  });
}
