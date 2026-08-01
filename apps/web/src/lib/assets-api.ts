import { apiFetch } from './api-client';

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export type BrandAsset = {
  id: string;
  category: string;
  source: string;
  status: string;
  visibility: string;
  original_filename: string;
  display_name: string | null;
  alt_text: string | null;
  detected_mime_type: string | null;
  declared_mime_type: string;
  actual_byte_size: string | null;
  width: number | null;
  height: number | null;
  scan_status: string;
  rejection_reason: string | null;
  public_cdn_url: string | null;
  public_published_at: string | null;
  public_unpublished_at: string | null;
  lock_version: number;
};

export type AssetAggregate = {
  asset: BrandAsset;
  variants: Array<{ id: string; kind: string; object_key: string; mime_type: string; byte_size: string }>;
};

export type CreateUploadResponse = {
  asset: BrandAsset;
  upload: { method: 'PUT'; uploadUrl: string; expiresAt: string };
};

export function listAssets(accessToken: string, workspaceId: string, projectId: string, versionId: string) {
  return apiFetch<BrandAsset[]>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/assets`, {
    headers: authHeaders(accessToken)
  });
}

export function createAssetUpload(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  input: { category: string; filename: string; mimeType: string; byteSize: number; altText?: string }
) {
  return apiFetch<CreateUploadResponse>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/assets/uploads`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ ...input, identityVersionId: versionId })
  });
}

export async function uploadAssetBytes(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });

  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status}.`);
  }

  return response.json() as Promise<{ ok: true; byteSize: number; checksumSha256: string }>;
}

export function completeAssetUpload(accessToken: string, workspaceId: string, projectId: string, versionId: string, assetId: string) {
  return apiFetch<AssetAggregate>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/assets/${assetId}/complete`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({})
  });
}

export function updateAsset(
  accessToken: string,
  workspaceId: string,
  projectId: string,
  versionId: string,
  assetId: string,
  input: { lockVersion: number; displayName?: string; altText?: string }
) {
  return apiFetch<AssetAggregate>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/assets/${assetId}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(input)
  });
}

export function archiveAsset(accessToken: string, workspaceId: string, projectId: string, versionId: string, assetId: string, lockVersion: number) {
  return apiFetch<{ ok: true }>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/assets/${assetId}?lockVersion=${lockVersion}`,
    { method: 'DELETE', headers: authHeaders(accessToken) }
  );
}

export function publishAsset(accessToken: string, workspaceId: string, projectId: string, versionId: string, assetId: string, lockVersion: number) {
  return apiFetch<BrandAsset>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/assets/${assetId}/publish`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ lockVersion })
  });
}

export function unpublishAsset(accessToken: string, workspaceId: string, projectId: string, versionId: string, assetId: string, lockVersion: number) {
  return apiFetch<BrandAsset>(`/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/assets/${assetId}/unpublish`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ lockVersion })
  });
}

export function getAssetDownloadUrl(accessToken: string, workspaceId: string, projectId: string, versionId: string, assetId: string) {
  return apiFetch<{ downloadUrl: string; expiresAt: string }>(
    `/workspaces/${workspaceId}/brand-identities/${projectId}/versions/${versionId}/assets/${assetId}/download-url`,
    { method: 'POST', headers: authHeaders(accessToken) }
  );
}
