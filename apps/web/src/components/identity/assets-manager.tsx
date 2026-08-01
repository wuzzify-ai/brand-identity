'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { normalizeApiError } from '../../lib/api-client';
import {
  archiveAsset,
  completeAssetUpload,
  createAssetUpload,
  getAssetDownloadUrl,
  listAssets,
  publishAsset,
  unpublishAsset,
  updateAsset,
  uploadAssetBytes,
  type BrandAsset
} from '../../lib/assets-api';
import { startLogoConceptGeneration, waitForGeneration } from '../../lib/generation-api';
import { listLogoConcepts, runLogoConceptAction, updateLogoConcept, type LogoConceptListItem } from '../../lib/logo-concepts-api';
import { Button } from '../ui/button';
import { TextAreaField, TextField } from '../ui/form';

type Props = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  onChanged?: () => void;
};

export function AssetsManager({ accessToken, workspaceId, projectId, versionId, onChanged }: Props) {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [concepts, setConcepts] = useState<LogoConceptListItem[]>([]);
  const [status, setStatus] = useState('Loading assets...');
  const [filter, setFilter] = useState('ALL');
  const [logoInstructions, setLogoInstructions] = useState('');
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({});
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    void reload();
    // eslint is not configured with react-hooks in this repo; deps below are the route/auth scope.
  }, [accessToken, workspaceId, projectId, versionId]);

  async function reload() {
    try {
      const [assetList, conceptList] = await Promise.all([
        listAssets(accessToken, workspaceId, projectId, versionId),
        listLogoConcepts(accessToken, workspaceId, projectId, versionId)
      ]);
      setAssets(assetList);
      setConcepts(conceptList);
      const conceptAssets = conceptList.flatMap((concept) => concept.assets).filter((asset) => asset.status === 'AVAILABLE').slice(0, 12);
      const previewEntries = await Promise.all(
        conceptAssets.map(async (asset) => {
          try {
            const grant = await getAssetDownloadUrl(accessToken, workspaceId, projectId, versionId, asset.id);
            return [asset.id, grant.downloadUrl] as const;
          } catch {
            return null;
          }
        })
      );
      setDownloadUrls((current) => ({ ...current, ...Object.fromEntries(previewEntries.filter((entry): entry is readonly [string, string] => Boolean(entry))) }));
      setStatus(`${assetList.length} assets and ${conceptList.length} logo concepts loaded.`);
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('assetFile');

    if (!(file instanceof File) || file.size === 0) {
      setStatus('Choose a file before uploading.');
      return;
    }

    try {
      setStatus('Creating upload grant...');
      const created = await createAssetUpload(accessToken, workspaceId, projectId, versionId, {
        category: String(form.get('category') ?? 'OTHER'),
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        byteSize: file.size,
        altText: String(form.get('altText') ?? '')
      });
      setStatus('Uploading file bytes...');
      await uploadAssetBytes(created.upload.uploadUrl, file);
      setStatus('Completing upload and starting scan...');
      await completeAssetUpload(accessToken, workspaceId, projectId, versionId, created.asset.id);
      await reload();
      onChanged?.();
      setStatus('Upload completed. Asset is processing.');
      event.currentTarget.reset();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function generateLogos() {
    if (logoBusy) return;
    setLogoBusy(true);
    try {
      const generation = await startLogoConceptGeneration(accessToken, {
        workspaceId,
        identityVersionId: versionId,
        count: 3,
        userInstructions: logoInstructions
      });
      setStatus('Logo concept generation queued.');
      await waitForGeneration(accessToken, generation.job.id, (state) => {
        setStatus(state.job.progress_message ?? `Logo generation is ${state.job.status.toLowerCase()}.`);
      }, 300_000);
      await reload();
      onChanged?.();
      setStatus('Logo concepts generated and loaded.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    } finally {
      setLogoBusy(false);
    }
  }

  async function saveAsset(asset: BrandAsset, formData: FormData) {
    try {
      await updateAsset(accessToken, workspaceId, projectId, versionId, asset.id, {
        lockVersion: asset.lock_version,
        displayName: String(formData.get('displayName') ?? ''),
        altText: String(formData.get('altText') ?? '')
      });
      await reload();
      setStatus('Asset metadata saved.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function downloadAsset(asset: BrandAsset) {
    try {
      const grant = await getAssetDownloadUrl(accessToken, workspaceId, projectId, versionId, asset.id);
      setDownloadUrls((current) => ({ ...current, [asset.id]: grant.downloadUrl }));
      window.open(grant.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function loadAssetPreview(asset: BrandAsset) {
    try {
      const grant = await getAssetDownloadUrl(accessToken, workspaceId, projectId, versionId, asset.id);
      setDownloadUrls((current) => ({ ...current, [asset.id]: grant.downloadUrl }));
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function publish(asset: BrandAsset) {
    try {
      if (asset.visibility === 'PUBLIC_CDN') {
        await unpublishAsset(accessToken, workspaceId, projectId, versionId, asset.id, asset.lock_version);
        setStatus('Asset unpublished from public listing.');
      } else {
        await publishAsset(accessToken, workspaceId, projectId, versionId, asset.id, asset.lock_version);
        setStatus('Asset published to public CDN listing.');
      }
      await reload();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function archive(asset: BrandAsset) {
    if (!window.confirm('Archive this asset? Existing references are preserved, but it leaves the active manager.')) return;
    try {
      await archiveAsset(accessToken, workspaceId, projectId, versionId, asset.id, asset.lock_version);
      await reload();
      setStatus('Asset archived.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function conceptAction(concept: LogoConceptListItem, action: 'shortlist' | 'select' | 'reject') {
    try {
      await runLogoConceptAction(accessToken, workspaceId, projectId, versionId, concept.id, action, concept.lock_version);
      await reload();
      setStatus(`Logo concept ${action} action saved.`);
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function saveConceptNotes(concept: LogoConceptListItem, formData: FormData) {
    try {
      await updateLogoConcept(accessToken, workspaceId, projectId, versionId, concept.id, {
        lockVersion: concept.lock_version,
        productionNotes: String(formData.get('productionNotes') ?? '')
      });
      await reload();
      setStatus('Logo concept notes saved.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  const visibleAssets = assets.filter((asset) => filter === 'ALL' || asset.status === filter || asset.source === filter || asset.visibility === filter);

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 className="section-title">Assets</h2>
          <p className="section-copy">{status}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['ALL', 'AVAILABLE', 'PROCESSING', 'REJECTED', 'AI_GENERATED', 'USER_UPLOAD', 'IMPORTED', 'PUBLIC_CDN'].map((item) => (
            <Button key={item} type="button" variant={filter === item ? 'primary' : 'secondary'} onClick={() => setFilter(item)}>
              {item}
            </Button>
          ))}
        </div>
      </div>

      <div className="two-column" style={{ marginTop: 18 }}>
        <form onSubmit={uploadFile} className="panel panel-pad" style={{ display: 'grid', gap: 12 }}>
          <h3>Authenticated upload</h3>
          <label className="field-stack">
            <span>Asset file</span>
            <input name="assetFile" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf" />
          </label>
          <TextField id="asset-category" name="category" label="Category" defaultValue="OTHER" />
          <TextAreaField id="asset-alt" name="altText" label="Alt text / review note" />
          <Button type="submit">Upload asset</Button>
        </form>

        <div className="panel panel-pad" style={{ display: 'grid', gap: 12 }}>
          <h3>Logo concepts</h3>
          <p className="section-copy">Every run creates three PNG logo choices. Previews are review-required; selection does not mean trademark-safe or production-ready.</p>
          <TextAreaField
            id="logo-instructions"
            label="Logo generation instructions"
            value={logoInstructions}
            onChange={(event) => setLogoInstructions(event.currentTarget.value)}
          />
          <Button type="button" disabled={logoBusy} onClick={() => void generateLogos()}>
            Generate logo concepts
          </Button>
        </div>
      </div>

      <section style={{ marginTop: 24 }}>
        <h3>Logo concept review</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {concepts.map((concept) => (
            <article key={concept.id} className="panel panel-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>{concept.name}</strong>
                  <p className="section-copy">
                    {concept.type} - {concept.status} - {concept.review_status}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button type="button" variant="secondary" onClick={() => void conceptAction(concept, 'shortlist')}>
                    Shortlist
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void conceptAction(concept, 'select')}>
                    Select
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void conceptAction(concept, 'reject')}>
                    Reject
                  </Button>
                </div>
              </div>
              {concept.assets.length ? (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                  {concept.assets.map((asset) => (
                    <div key={asset.id} style={{ width: 180 }}>
                      {downloadUrls[asset.id] ? (
                        // Signed asset URLs are dynamic and intentionally bypass Next image optimization.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={downloadUrls[asset.id]}
                          alt={asset.alt_text ?? asset.display_name ?? concept.name}
                          style={{ width: '100%', height: 140, objectFit: 'contain', borderRadius: 12, background: 'var(--color-surface)' }}
                        />
                      ) : (
                        <Button type="button" variant="secondary" disabled={asset.status !== 'AVAILABLE'} onClick={() => void loadAssetPreview(asset)}>
                          Load preview
                        </Button>
                      )}
                      <p className="section-copy">{asset.display_name ?? asset.original_filename}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <p>{concept.rationale}</p>
              <ul>
                {concept.review_warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveConceptNotes(concept, new FormData(event.currentTarget));
                }}
                style={{ display: 'grid', gap: 8 }}
              >
                <TextAreaField id={`concept-notes-${concept.id}`} name="productionNotes" label="Production/review notes" defaultValue={concept.production_notes ?? ''} />
                <Button type="submit" variant="secondary">
                  Save notes
                </Button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Asset manager</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {visibleAssets.map((asset) => (
            <article key={asset.id} className="panel panel-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>{asset.display_name ?? asset.original_filename}</strong>
                  <p className="section-copy">
                    {asset.category} - {asset.source} - {asset.status} - {asset.visibility} - scan {asset.scan_status}
                  </p>
                  {asset.rejection_reason ? <p style={{ color: 'var(--color-coral)' }}>{asset.rejection_reason}</p> : null}
                  {asset.public_cdn_url ? <p className="section-copy">CDN: {asset.public_cdn_url}</p> : null}
                  {downloadUrls[asset.id] ? <p className="section-copy">Signed download ready until expiry.</p> : null}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button type="button" variant="secondary" disabled={asset.status !== 'AVAILABLE'} onClick={() => void downloadAsset(asset)}>
                    Download
                  </Button>
                  <Button type="button" variant="secondary" disabled={asset.status !== 'AVAILABLE'} onClick={() => void publish(asset)}>
                    {asset.visibility === 'PUBLIC_CDN' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void archive(asset)}>
                    Archive
                  </Button>
                </div>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveAsset(asset, new FormData(event.currentTarget));
                }}
                className="two-column"
                style={{ marginTop: 12 }}
              >
                <TextField id={`asset-name-${asset.id}`} name="displayName" label="Display name" defaultValue={asset.display_name ?? ''} />
                <TextField id={`asset-alt-${asset.id}`} name="altText" label="Alt text" defaultValue={asset.alt_text ?? ''} />
                <Button type="submit" variant="secondary">
                  Save asset metadata
                </Button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
