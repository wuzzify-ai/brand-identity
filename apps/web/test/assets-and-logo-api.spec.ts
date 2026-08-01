import { describe, expect, it } from 'vitest';
import type { BrandAsset } from '../src/lib/assets-api';
import type { LogoConceptListItem } from '../src/lib/logo-concepts-api';

describe('asset and logo frontend contracts', () => {
  it('represents CDN-published assets and review-required logo concepts', () => {
    const asset: BrandAsset = {
      id: 'asset-id',
      category: 'LOGO_CONCEPT',
      source: 'AI_GENERATED',
      status: 'AVAILABLE',
      visibility: 'PUBLIC_CDN',
      original_filename: 'logo.png',
      display_name: 'Logo preview',
      alt_text: 'Abstract logo mark',
      detected_mime_type: 'image/png',
      declared_mime_type: 'image/png',
      actual_byte_size: '1024',
      width: 512,
      height: 512,
      scan_status: 'PASSED',
      rejection_reason: null,
      public_cdn_url: 'https://cdn.example/logo.png',
      public_published_at: '2026-07-22T00:00:00.000Z',
      public_unpublished_at: null,
      lock_version: 2
    };
    const concept: LogoConceptListItem = {
      id: 'concept-id',
      type: 'COMBINATION',
      status: 'SELECTED',
      review_status: 'REVIEW_REQUIRED',
      name: 'Signal lockup',
      rationale: 'Clear and scalable.',
      language_codes: ['en', 'ar'],
      prompt: 'Create an original abstract logo.',
      production_notes: null,
      review_warnings: ['Trademark search is required before production use.'],
      metadata: {},
      lock_version: 1,
      assets: [asset]
    };

    expect(asset.public_cdn_url).toContain('https://');
    expect(concept.review_status).toBe('REVIEW_REQUIRED');
    expect(concept.assets[0]?.visibility).toBe('PUBLIC_CDN');
  });
});
