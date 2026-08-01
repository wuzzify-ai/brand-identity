import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { stableStringify } from '@wuzzify/brand-design-tokens';
import { DomainError } from '../common/domain-error';
import { AssetUrlSigner } from '../assets/storage/asset-url-signer.service';
import { PrivateAssetStorage } from '../assets/storage/private-asset-storage.service';

type ExportRow = {
  id: string;
  brand_book_id: string;
  format: string;
  object_key: string;
  mime_type: string;
};

type BrandBookContext = {
  tokenSet: { id: string };
  [key: string]: unknown;
};

type PreviewAsset = {
  id: string;
  src: string;
  name: string;
  alt: string;
  category: string;
  source: string;
};

@Injectable()
export class BrandBooksService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: PrivateAssetStorage,
    private readonly signer: AssetUrlSigner,
    private readonly config: ConfigService
  ) {}

  async generate(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const context = await this.loadContext(projectId, versionId);
    const previewAssets = await this.loadPreviewAssets(context);
    const manifest = this.buildManifest(versionId, context);
    const manifestJson = stableStringify(manifest);
    const manifestChecksum = sha(manifestJson);
    const html = renderHtml(manifest, previewAssets);

    const brandBookId = await this.dataSource.transaction(async (manager) => {
      await manager.query(`UPDATE brand_books SET is_current = false WHERE identity_version_id = $1 AND is_current`, [versionId]);
      const revisionRows = await manager.query<{ next_revision: string }[]>(
        `SELECT COALESCE(MAX(revision), 0) + 1 AS next_revision FROM brand_books WHERE identity_version_id = $1`,
        [versionId]
      );
      const bookRows = await manager.query<{ id: string }[]>(
        `INSERT INTO brand_books (
          identity_version_id, design_token_set_id, revision, status, manifest_json,
          manifest_checksum_sha256, html_preview, is_current
        )
        VALUES ($1, $2, $3, 'READY', $4::jsonb, $5, $6, true)
        RETURNING id`,
        [versionId, context.tokenSet.id, Number(revisionRows[0]?.next_revision ?? 1), manifestJson, manifestChecksum, html]
      );
      const insertedBrandBookId = bookRows[0]?.id as string;
      const htmlObject = await this.writeExport(versionId, insertedBrandBookId, 'brand-book.html', Buffer.from(html, 'utf8'));
      const manifestObject = await this.writeExport(versionId, insertedBrandBookId, 'manifest.json', Buffer.from(manifestJson, 'utf8'));

      await manager.query(
        `INSERT INTO brand_book_exports (brand_book_id, format, object_key, mime_type, byte_size, checksum_sha256)
         VALUES ($1, 'HTML', $2, 'text/html; charset=utf-8', $3, $4),
                ($1, 'MANIFEST_JSON', $5, 'application/json; charset=utf-8', $6, $7)`,
        [
          insertedBrandBookId,
          htmlObject.key,
          htmlObject.byteSize,
          htmlObject.checksumSha256,
          manifestObject.key,
          manifestObject.byteSize,
          manifestObject.checksumSha256
        ]
      );
      return insertedBrandBookId;
    });

    return this.get(workspaceId, projectId, versionId, brandBookId);
  }

  async list(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    return this.dataSource.query(`SELECT * FROM brand_books WHERE identity_version_id = $1 ORDER BY revision DESC`, [versionId]);
  }

  async get(workspaceId: string, projectId: string, versionId: string, brandBookId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const [books, exports] = await Promise.all([
      this.dataSource.query(`SELECT * FROM brand_books WHERE id = $1 AND identity_version_id = $2`, [brandBookId, versionId]),
      this.dataSource.query(`SELECT * FROM brand_book_exports WHERE brand_book_id = $1 ORDER BY format ASC`, [brandBookId])
    ]);
    if (!books[0]) throw new DomainError('BRAND_BOOK_NOT_FOUND', 'Brand book was not found.', 404);
    return { brandBook: books[0], exports };
  }

  async getCurrent(workspaceId: string, projectId: string, versionId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query(`SELECT id FROM brand_books WHERE identity_version_id = $1 AND is_current`, [versionId]);
    if (!rows[0]) return { brandBook: null, exports: [] };
    return this.get(workspaceId, projectId, versionId, rows[0].id);
  }

  async getExportDownloadGrant(workspaceId: string, projectId: string, versionId: string, exportId: string) {
    await this.assertVersionAccess(workspaceId, projectId, versionId);
    const rows = await this.dataSource.query<ExportRow[]>(
      `SELECT brand_book_exports.*
       FROM brand_book_exports
       JOIN brand_books ON brand_books.id = brand_book_exports.brand_book_id
       WHERE brand_book_exports.id = $1 AND brand_books.identity_version_id = $2 AND brand_book_exports.status = 'READY'`,
      [exportId, versionId]
    );
    const exportRow = rows[0];
    if (!exportRow) throw new DomainError('BRAND_BOOK_EXPORT_NOT_FOUND', 'Brand book export was not found.', 404);

    const expiresAt = new Date(Date.now() + 300_000);
    const token = this.signer.sign({
      assetId: exportRow.id,
      objectKey: exportRow.object_key,
      purpose: 'download',
      expiresAt: expiresAt.toISOString()
    });
    const baseUrl = this.config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '');
    return {
      downloadUrl: `${baseUrl}/v1/brand-book-download-objects/${exportRow.id}?token=${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString()
    };
  }

  async resolveExportDownload(exportId: string, token: string) {
    const payload = this.signer.verify(token, 'download');
    if (payload.assetId !== exportId) throw new DomainError('BRAND_BOOK_DOWNLOAD_TOKEN_INVALID', 'Download token is invalid.', 403);
    const rows = await this.dataSource.query<ExportRow[]>(`SELECT * FROM brand_book_exports WHERE id = $1 AND status = 'READY'`, [exportId]);
    const exportRow = rows[0];
    if (!exportRow || exportRow.object_key !== payload.objectKey) {
      throw new DomainError('BRAND_BOOK_EXPORT_NOT_FOUND', 'Brand book export was not found.', 404);
    }
    return exportRow;
  }

  private async writeExport(versionId: string, brandBookId: string, filename: string, body: Buffer) {
    const key = `exports/brand-books/${versionId}/${brandBookId}/${filename}`;
    await this.storage.writeObject(key, body);
    return { key, byteSize: body.byteLength, checksumSha256: sha(body) };
  }

  private async loadContext(projectId: string, versionId: string): Promise<BrandBookContext> {
    const rows = await this.dataSource.query<Array<{ context_json: Record<string, unknown> }>>(
      `SELECT jsonb_build_object(
        'project', to_jsonb(identity_projects),
        'version', to_jsonb(identity_versions),
        'brief', (SELECT to_jsonb(brand_briefs) FROM brand_briefs WHERE identity_version_id = $2 AND confirmed_at IS NOT NULL),
        'strategy', (SELECT to_jsonb(brand_strategies) FROM brand_strategies WHERE identity_version_id = $2 AND confirmed_at IS NOT NULL),
        'visualDirection', (SELECT to_jsonb(visual_directions) FROM visual_directions WHERE identity_version_id = $2 AND is_selected AND status = 'ACTIVE'),
        'visualColors', COALESCE((SELECT jsonb_agg(to_jsonb(visual_colors) ORDER BY sort_order) FROM visual_colors JOIN visual_directions selected_visual ON selected_visual.id = visual_colors.visual_direction_id WHERE selected_visual.identity_version_id = $2 AND selected_visual.is_selected AND selected_visual.status = 'ACTIVE'), '[]'::jsonb),
        'visualFonts', COALESCE((SELECT jsonb_agg(to_jsonb(visual_fonts) ORDER BY sort_order) FROM visual_fonts JOIN visual_directions selected_visual ON selected_visual.id = visual_fonts.visual_direction_id WHERE selected_visual.identity_version_id = $2 AND selected_visual.is_selected AND selected_visual.status = 'ACTIVE'), '[]'::jsonb),
        'logoConcept', (SELECT jsonb_build_object(
          'concept', to_jsonb(selected_logo),
          'assets', COALESCE((SELECT jsonb_agg(to_jsonb(brand_assets) ORDER BY logo_concept_assets.sort_order)
            FROM logo_concept_assets
            JOIN brand_assets ON brand_assets.id = logo_concept_assets.brand_asset_id AND brand_assets.status = 'AVAILABLE'
            WHERE logo_concept_assets.logo_concept_id = selected_logo.id), '[]'::jsonb)
        ) FROM logo_concepts selected_logo WHERE selected_logo.identity_version_id = $2 AND selected_logo.status = 'SELECTED'),
        'tokenSet', (SELECT to_jsonb(design_token_sets) FROM design_token_sets WHERE identity_version_id = $2 AND format = 'JSON' AND is_current),
        'assets', COALESCE((SELECT jsonb_agg(to_jsonb(brand_assets) ORDER BY created_at) FROM brand_assets WHERE identity_version_id = $2 AND status = 'AVAILABLE'), '[]'::jsonb)
      ) AS context_json
       FROM identity_projects
       JOIN identity_versions ON identity_versions.identity_project_id = identity_projects.id
       WHERE identity_projects.id = $1 AND identity_versions.id = $2`,
      [projectId, versionId]
    );
    const context = rows[0]?.context_json as { tokenSet?: { id: string } } & Record<string, unknown>;
    if (!context?.tokenSet?.id) throw new DomainError('BRAND_BOOK_INPUTS_INCOMPLETE', 'Compile design tokens before generating a brand book.', 409);
    return context as BrandBookContext;
  }

  private async loadPreviewAssets(context: BrandBookContext): Promise<PreviewAsset[]> {
    const assets = Array.isArray(context.assets) ? (context.assets as Array<Record<string, unknown>>) : [];
    const previews: PreviewAsset[] = [];
    const maxInlineBytes = 5 * 1024 * 1024;

    for (const asset of assets) {
      const mimeType = String(asset.detected_mime_type ?? asset.declared_mime_type ?? '');
      const objectKey = String(asset.object_key ?? '');
      if (!String(asset.id ?? '') || !objectKey || !mimeType.startsWith('image/')) continue;

      try {
        const bytes = await this.storage.readObject(objectKey);
        if (bytes.byteLength > maxInlineBytes) continue;
        previews.push({
          id: String(asset.id),
          src: `data:${mimeType};base64,${bytes.toString('base64')}`,
          name: String(asset.display_name ?? asset.original_filename ?? 'Brand asset'),
          alt: String(asset.alt_text ?? asset.display_name ?? asset.original_filename ?? 'Brand asset'),
          category: String(asset.category ?? 'OTHER'),
          source: String(asset.source ?? 'UNKNOWN')
        });
      } catch {
        // A missing/quarantined object should not prevent the final package
        // from being generated; it is simply omitted from the preview.
      }
    }

    return previews;
  }

  private buildManifest(versionId: string, context: Record<string, unknown>) {
    return {
      versionId,
      generatedAt: new Date(0).toISOString(),
      context
    };
  }

  private async assertVersionAccess(workspaceId: string, projectId: string, versionId: string) {
    const rows = await this.dataSource.query(
      `SELECT identity_versions.id
       FROM identity_versions
       JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
       WHERE identity_versions.id = $1 AND identity_projects.id = $2 AND identity_projects.workspace_id = $3 AND identity_projects.status = 'ACTIVE'`,
      [versionId, projectId, workspaceId]
    );
    if (!rows[0]) throw new DomainError('IDENTITY_VERSION_NOT_FOUND', 'Identity version was not found.', 404);
  }
}

function renderHtml(manifest: Record<string, unknown>, previewAssets: PreviewAsset[]): string {
  const context = manifest.context as Record<string, unknown>;
  const project = context.project as { name?: string };
  const strategy = context.strategy as { positioning?: string; value_proposition?: string; taglines?: string[] } | null;
  const visualDirection = context.visualDirection as { name?: string; rationale?: string } | null;
  const visualColors = (context.visualColors as Array<{ name?: string; hex?: string; usage?: string }> | undefined) ?? [];
  const visualFonts = (context.visualFonts as Array<{ role?: string; family?: string; fallback?: string; weights?: number[] }> | undefined) ?? [];
  const logoBundle = context.logoConcept as { concept?: { name?: string; rationale?: string }; assets?: Array<{ id?: string }> } | null;
  const logoConcept = logoBundle?.concept ?? null;
  const selectedLogoIds = new Set((logoBundle?.assets ?? []).map((asset) => asset.id).filter((id): id is string => Boolean(id)));
  const logoAssets = previewAssets.filter((asset) => selectedLogoIds.has(asset.id));
  const palette = visualColors.filter((color) => /^#[0-9A-Fa-f]{6}$/.test(color.hex ?? ''));
  const primary = palette.find((color) => `${color.name} ${color.usage}`.toLowerCase().includes('primary'))?.hex ?? palette[0]?.hex ?? '#111827';
  const accent = palette.find((color) => `${color.name} ${color.usage}`.toLowerCase().includes('accent'))?.hex ?? palette[1]?.hex ?? '#06B6D4';
  const surface = palette.find((color) => `${color.name} ${color.usage}`.toLowerCase().includes('surface'))?.hex ?? '#F8FAFC';
  const bodyCopy = strategy?.value_proposition ?? strategy?.positioning ?? 'A focused identity system designed to move your brand forward.';
  const tagline = strategy?.taglines?.[0] ?? strategy?.positioning ?? 'A clear point of view for what comes next.';
  const assetCards = previewAssets
    .map(
      (asset) => `<figure class="asset-card"><img src="${asset.src}" alt="${escapeHtml(asset.alt)}"/><figcaption><strong>${escapeHtml(asset.name)}</strong><span>${escapeHtml(asset.category)} - ${escapeHtml(asset.source)}</span></figcaption></figure>`
    )
    .join('');
  const logoMarkup = (logoAssets.length ? logoAssets : previewAssets.filter((asset) => asset.category === 'LOGO_CONCEPT')).slice(0, 3)
    .map((asset) => `<img class="logo-mark" src="${asset.src}" alt="${escapeHtml(asset.alt)}"/>`)
    .join('');
  const colorsMarkup = palette
    .map((color) => `<div class="swatch"><span style="background:${color.hex}"></span><strong>${escapeHtml(color.name ?? 'Color')}</strong><small>${escapeHtml(color.hex ?? '')}</small></div>`)
    .join('');
  const fontsMarkup = visualFonts
    .map((font) => `<div class="font-row"><strong>${escapeHtml(font.role ?? 'Text')}</strong><span style="font-family:${escapeCss(font.family ?? 'system-ui')},sans-serif">${escapeHtml(font.family ?? 'System UI')}</span></div>`)
    .join('');

  return [
    '<!doctype html>',
    '<html lang="en">',
    `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(project?.name ?? 'Brand preview')}</title><style>
      :root{--brand-primary:${primary};--brand-accent:${accent};--brand-surface:${surface};--brand-ink:#111827;--brand-muted:#64748B;--radius:24px}
      *{box-sizing:border-box}body{margin:0;background:var(--brand-surface);color:var(--brand-ink);font-family:Inter,Arial,sans-serif;line-height:1.5}a{color:inherit;text-decoration:none}.shell{max-width:1180px;margin:auto;padding:24px}.nav{display:flex;justify-content:space-between;align-items:center;padding:8px 0 42px}.nav strong{font-size:18px}.nav-links{display:flex;gap:24px;color:var(--brand-muted);font-size:14px}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:56px;align-items:center;padding:54px 0 92px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;color:var(--brand-accent);font-size:12px;font-weight:800}.hero h1{font-size:clamp(42px,7vw,82px);line-height:1.02;letter-spacing:-.06em;margin:16px 0}.hero p{font-size:19px;color:var(--brand-muted);max-width:600px}.actions{display:flex;gap:12px;margin-top:28px}.button{border-radius:999px;padding:13px 20px;background:var(--brand-primary);color:white;font-weight:700}.button.alt{background:transparent;color:var(--brand-primary);border:1px solid color-mix(in srgb,var(--brand-primary) 24%,transparent)}.hero-card{min-height:390px;border-radius:var(--radius);background:var(--brand-primary);display:grid;place-items:center;box-shadow:0 28px 70px color-mix(in srgb,var(--brand-primary) 24%,transparent);overflow:hidden}.logo-mark{max-width:78%;max-height:210px;object-fit:contain;filter:drop-shadow(0 14px 24px rgba(0,0,0,.2))}.section{padding:70px 0}.section h2{font-size:36px;letter-spacing:-.04em;margin:0 0 10px}.section-intro{color:var(--brand-muted);max-width:650px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:28px}.card{background:white;border:1px solid rgba(15,23,42,.08);border-radius:var(--radius);padding:24px}.swatch span{display:block;height:90px;border-radius:16px;margin-bottom:14px}.swatch strong,.swatch small{display:block}.swatch small,.font-row span{color:var(--brand-muted)}.font-row{display:flex;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid rgba(15,23,42,.1)}.asset-card{margin:0;background:white;border:1px solid rgba(15,23,42,.08);border-radius:var(--radius);overflow:hidden}.asset-card img{width:100%;height:220px;object-fit:contain;background:#fff}.asset-card figcaption{display:grid;gap:3px;padding:16px}.asset-card span{font-size:12px;color:var(--brand-muted)}.footer{padding:40px 0;color:var(--brand-muted);font-size:13px;border-top:1px solid rgba(15,23,42,.1)}@media(max-width:760px){.hero{grid-template-columns:1fr;padding-top:24px}.grid{grid-template-columns:1fr}.nav-links{display:none}}
    </style></head>`,
    '<body>',
    '<div class="shell">',
    `<nav class="nav"><strong>${escapeHtml(project?.name ?? 'Brand')}</strong><div class="nav-links"><a href="#story">Story</a><a href="#system">System</a><a href="#assets">Assets</a></div></nav>`,
    '<main>',
    `<section class="hero"><div><div class="eyebrow">${escapeHtml(visualDirection?.name ?? 'Selected visual direction')}</div><h1>${escapeHtml(tagline)}</h1><p>${escapeHtml(bodyCopy)}</p><div class="actions"><a class="button" href="#story">Explore the identity</a><a class="button alt" href="#assets">View resources</a></div></div><div class="hero-card">${logoMarkup || `<span style="color:white;font-size:32px;font-weight:800">${escapeHtml(project?.name ?? 'Brand')}</span>`}</div></section>`,
    `<section id="story" class="section"><div class="eyebrow">The point of view</div><h2>${escapeHtml(logoConcept?.name ?? 'A recognizable system')}</h2><p class="section-intro">${escapeHtml(logoConcept?.rationale ?? visualDirection?.rationale ?? 'A coherent identity system brings strategy, visual language, and useful resources together.')}</p></section>`,
    `<section id="system" class="section"><div class="eyebrow">The system</div><h2>Built to stay consistent</h2><div class="grid"><div class="card"><h3>Color</h3>${colorsMarkup || '<p class="section-intro">Palette details are being prepared.</p>'}</div><div class="card"><h3>Typography</h3>${fontsMarkup || '<p class="section-intro">Typography details are being prepared.</p>'}</div><div class="card"><h3>Direction</h3><p>${escapeHtml(visualDirection?.name ?? 'Selected direction')}</p><p class="section-intro">${escapeHtml(visualDirection?.rationale ?? '')}</p></div></div></section>`,
    `<section id="assets" class="section"><div class="eyebrow">Generated resources</div><h2>Ready for the next touchpoint</h2><p class="section-intro">Three logo directions and the available generated resources are shown here as a working landing-page preview.</p><div class="grid">${assetCards || '<div class="card"><p class="section-intro">No image assets are available yet.</p></div>'}</div></section>`,
    '</main>',
    `<footer class="footer">Generated from identity version ${escapeHtml(String(manifest.versionId))}. This preview is a functional direction, not a production deployment.</footer>`,
    '</div></body></html>'
  ].join('');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);
}

function escapeCss(value: string): string {
  return value.replace(/[^a-zA-Z0-9 ,.'_-]/g, '');
}

function sha(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
