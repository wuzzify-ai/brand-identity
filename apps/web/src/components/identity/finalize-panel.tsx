'use client';

import { useEffect, useState } from 'react';
import { normalizeApiError } from '../../lib/api-client';
import {
  compileDesignTokens,
  generateBrandBook,
  getApprovalHistory,
  getBrandBookExportDownloadUrl,
  getCurrentBrandBook,
  listCurrentDesignTokens,
  runApprovalAction,
  type ApprovalDecision,
  type BrandBookAggregate,
  type DesignTokenSet
} from '../../lib/finalize-api';
import { Button } from '../ui/button';
import { TextAreaField } from '../ui/form';

type Props = {
  accessToken: string;
  workspaceId: string;
  projectId: string;
  versionId: string;
  onChanged?: () => void;
};

export function FinalizePanel({ accessToken, workspaceId, projectId, versionId, onChanged }: Props) {
  const [tokens, setTokens] = useState<DesignTokenSet[]>([]);
  const [brandBook, setBrandBook] = useState<BrandBookAggregate | null>(null);
  const [history, setHistory] = useState<ApprovalDecision[]>([]);
  const [status, setStatus] = useState('Loading final package...');
  const [reason, setReason] = useState('');

  useEffect(() => {
    void reload();
    // Route/auth scoped reload.
  }, [accessToken, workspaceId, projectId, versionId]);

  async function reload() {
    try {
      const [tokenRows, decisions] = await Promise.all([
        listCurrentDesignTokens(accessToken, workspaceId, projectId, versionId).catch(() => []),
        getApprovalHistory(accessToken, workspaceId, projectId, versionId).catch(() => [])
      ]);
      setTokens(tokenRows);
      setHistory(decisions);
      const currentBrandBook = await getCurrentBrandBook(accessToken, workspaceId, projectId, versionId);
      setBrandBook(currentBrandBook.brandBook ? currentBrandBook : null);
      setStatus('Finalize package loaded.');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function compile() {
    try {
      const result = await compileDesignTokens(accessToken, workspaceId, projectId, versionId);
      setTokens(result.tokenSets);
      setStatus(`Design tokens compiled. Canonical checksum ${result.canonicalChecksum.slice(0, 12)}...`);
      onChanged?.();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function generateBook() {
    try {
      setBrandBook(await generateBrandBook(accessToken, workspaceId, projectId, versionId));
      setStatus('Brand book generated.');
      onChanged?.();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function downloadExport(exportId: string) {
    try {
      const grant = await getBrandBookExportDownloadUrl(accessToken, workspaceId, projectId, versionId, exportId);
      window.open(grant.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  async function approval(action: 'submit' | 'approve' | 'reject' | 'activate') {
    if (action === 'activate' && !window.confirm('Activate this identity version? The previous active version will be superseded.')) {
      return;
    }

    try {
      const result = await runApprovalAction(accessToken, workspaceId, projectId, versionId, action, reason);
      setStatus(result.activeVersionId ? `Activated version ${result.activeVersionId}.` : `Approval action saved: ${action}.`);
      setReason('');
      await reload();
      onChanged?.();
    } catch (caught) {
      setStatus(normalizeApiError(caught).message);
    }
  }

  return (
    <section className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 className="section-title">Finalize</h2>
          <p className="section-copy">{status}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="secondary" onClick={() => void compile()}>
            Compile tokens
          </Button>
          <Button type="button" variant="secondary" onClick={() => void generateBook()}>
            Generate brand book
          </Button>
        </div>
      </div>

      <div className="two-column" style={{ marginTop: 18 }}>
        <section className="panel panel-pad">
          <h3>Design tokens</h3>
          {tokens.map((tokenSet) => (
            <article key={tokenSet.id} className="panel panel-pad" style={{ marginTop: 10 }}>
              <strong>{tokenSet.format}</strong>
              <p className="section-copy">
                Revision {tokenSet.revision} - checksum {tokenSet.checksum_sha256.slice(0, 12)}...
              </p>
              {tokenSet.content_text ? <pre style={{ overflow: 'auto', maxHeight: 180 }}>{tokenSet.content_text}</pre> : null}
            </article>
          ))}
        </section>

        <section className="panel panel-pad">
          <h3>Brand book exports</h3>
          {brandBook ? (
            <>
              <p className="section-copy">
                Revision {brandBook.brandBook.revision} - {brandBook.brandBook.status} - manifest {brandBook.brandBook.manifest_checksum_sha256.slice(0, 12)}...
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {brandBook.exports.map((item) => (
                  <Button key={item.id} type="button" variant="secondary" onClick={() => void downloadExport(item.id)}>
                    Download {item.format}
                  </Button>
                ))}
              </div>
              <details style={{ marginTop: 12 }} open>
                <summary>Landing page preview</summary>
                <p className="section-copy">This preview uses the selected strategy, visual system, logo options, and available generated assets.</p>
                <iframe title="Brand book preview" srcDoc={brandBook.brandBook.html_preview} style={{ width: '100%', minHeight: 420, border: '1px solid var(--color-border)' }} />
              </details>
            </>
          ) : (
            <p className="section-copy">No brand book generated yet.</p>
          )}
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginTop: 18 }}>
        <h3>Approval and activation</h3>
        <TextAreaField id="approval-reason" label="Reason / review note" value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Button type="button" variant="secondary" onClick={() => void approval('submit')}>
            Submit
          </Button>
          <Button type="button" variant="secondary" onClick={() => void approval('approve')}>
            Approve
          </Button>
          <Button type="button" variant="secondary" onClick={() => void approval('reject')}>
            Reject
          </Button>
          <Button type="button" onClick={() => void approval('activate')}>
            Activate
          </Button>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          {history.map((decision) => (
            <article key={decision.id} className="panel panel-pad">
              <strong>{decision.decision}</strong>
              <p className="section-copy">
                {decision.from_status} to {decision.to_status} - {new Date(decision.created_at).toLocaleString()}
              </p>
              {decision.reason ? <p>{decision.reason}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
