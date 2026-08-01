import { apiFetch } from './api-client';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export function listSessions(accessToken: string) {
  return apiFetch<
    {
      id: string;
      deviceName: string | null;
      userAgent: string | null;
      createdAt: string;
      lastUsedAt: string;
      expiresAt: string;
      revokedAt: string | null;
      current: boolean;
    }[]
  >('/auth/sessions', { headers: authHeaders(accessToken) });
}

export function revokeSession(accessToken: string, sessionId: string) {
  return apiFetch('/auth/sessions/' + sessionId, {
    method: 'DELETE',
    headers: authHeaders(accessToken)
  });
}

export function listWorkspaces(accessToken: string) {
  return apiFetch<{ id: string; name: string; slug: string; role: string; lock_version: number }[]>('/workspaces', {
    headers: authHeaders(accessToken)
  });
}

export function createWorkspace(accessToken: string, input: { name: string; slug: string }) {
  return apiFetch('/workspaces', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input)
  });
}

export function inviteMember(
  accessToken: string,
  workspaceId: string,
  input: { email: string; role: 'EDITOR' | 'REVIEWER' | 'VIEWER' }
) {
  return apiFetch(`/workspaces/${workspaceId}/invitations`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input)
  });
}

export function acceptInvitation(accessToken: string, token: string) {
  return apiFetch<{ ok: boolean; workspaceId: string }>('/workspaces/invitations/accept', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ token })
  });
}
