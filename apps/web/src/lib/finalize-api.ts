import { apiFetch } from './api-client';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type DesignTokenSet = {
  id: string;
  format: 'JSON' | 'CSS' | 'SCSS' | 'TAILWIND';
  revision: number;
  checksum_sha256: string;
  content_json: unknown | null;
  content_text: string | null;
  created_at: string;
};

export type BrandBookExport = {
  id: string;
  format: string;
  status: string;
  checksum_sha256: string;
  byte_size: string;
};

export type BrandBookAggregate = {
  brandBook: {
    id: string;
    revision: number;
    status: string;
    manifest_checksum_sha256: string;
    html_preview: string;
    created_at: string;
  };
  exports: BrandBookExport[];
};

export type CurrentBrandBookAggregate = BrandBookAggregate | {
  brandBook: null;
  exports: [];
};

export type ApprovalDecision = {
  id: string;
  decision: string;
  from_status: string;
  to_status: string;
  reason: string | null;
  created_at: string;
};

export function compileDesignTokens(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<{ tokenSets: DesignTokenSet[]; canonicalChecksum: string; sourceFingerprint: string }>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/design-tokens/compile`,
    { method: 'POST', headers: authHeaders(accessToken) }
  );
}

export function listCurrentDesignTokens(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<DesignTokenSet[]>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/design-tokens`, {
    headers: authHeaders(accessToken)
  });
}

export function generateBrandBook(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<BrandBookAggregate>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brand-books/generate`, {
    method: 'POST',
    headers: authHeaders(accessToken)
  });
}

export function getCurrentBrandBook(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<CurrentBrandBookAggregate>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brand-books/current`, {
    headers: authHeaders(accessToken)
  });
}

export function getBrandBookExportDownloadUrl(accessToken: string, workspaceId: string, projectId: string, versionId: string, exportId: string) {
  return apiFetch<{ downloadUrl: string; expiresAt: string }>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/brand-books/exports/${exportId}/download-url`,
    { method: 'POST', headers: authHeaders(accessToken) }
  );
}

export function getApprovalHistory(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<ApprovalDecision[]>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/approval/history`, {
    headers: authHeaders(accessToken)
  });
}

export function runApprovalAction(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  action: 'submit' | 'approve' | 'reject' | 'activate',
  reason: string
) {
  return apiFetch<{ ok: true; status?: string; activeVersionId?: string }>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/approval/${action}`,
    {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ reason })
    }
  );
}
