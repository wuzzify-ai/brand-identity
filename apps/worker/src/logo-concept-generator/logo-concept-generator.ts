import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { z } from 'zod';
import { deflateSync } from 'zlib';
import { AiPolicyResolverService } from '../ai/ai-policy-resolver.service.js';
import type { StageGenerationJob, StageGenerationResult, StageGenerator } from '../generations/stage-generator.factory.js';
import { OpenRouterImageTransport } from '../image-transport/openrouter-image-transport.js';
import { PrivateObjectStorage } from '../image-transport/private-object-storage.js';
import type { IngestedImage } from '../image-transport/image-types.js';

const logoInputSchema = z.object({
  count: z.number().int().min(1).max(5).default(3),
  languageCodes: z.array(z.string()).default([]),
  useCase: z.string().default('primary brand identity'),
  userInstructions: z.string().default('')
});

type LogoConceptSpec = {
  type: 'WORDMARK' | 'LETTERMARK' | 'SYMBOL' | 'COMBINATION' | 'EMBLEM';
  name: string;
  rationale: string;
  prompt: string;
  languageCodes: string[];
  warnings: string[];
  image?: IngestedImage;
  imageError?: string;
};

type LogoContext = {
  workspaceId: string;
  projectId: string;
  projectName: string;
  selectedVisualDirectionId: string;
  languages: string[];
  strategy: Record<string, unknown>;
  visualDirection: Record<string, unknown>;
  colors: Array<{ name: string; hex: string; usage: string | null }>;
  fonts: Array<{ role: string; family: string; license_status: string }>;
};

@Injectable()
export class LogoConceptGenerator implements StageGenerator {
  constructor(
    private readonly policies: AiPolicyResolverService,
    private readonly imageTransport: OpenRouterImageTransport,
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storage: PrivateObjectStorage
  ) {}

  async generate(job: StageGenerationJob): Promise<StageGenerationResult> {
    const input = logoInputSchema.parse(job.input);
    const policy = await this.policies.resolve(job.task, job.tier);
    const context = await this.loadContext(job.identityVersionId);
    // Every asset run produces a reviewable set of three alternatives. This
    // keeps the workflow comparable and prevents a single generated option
    // from becoming an accidental default.
    const concepts = this.planConcepts(context, 3, input.languageCodes, input.useCase, input.userInstructions);

    await Promise.all(concepts.map(async (concept, variantIndex) => {
      try {
        const image = await this.imageTransport.generate({
          prompt: concept.prompt,
          models: [policy.primary_model, ...(policy.fallback_models ?? [])],
          userKey: `${job.id}:${concept.name}`,
          size: String(policy.request_parameters.size ?? '1024x1024'),
          count: 1,
          format: String(policy.request_parameters.output_format ?? 'png') as 'png',
          // OpenRouter's current image capability metadata does not advertise
          // transparency for the selected logo model. Keep the result PNG,
          // but avoid rejecting the AI request before it is generated.
          transparentBackground: false,
          requestParameters: policy.request_parameters,
          providerPreferences: policy.provider_preferences,
          // Keep the three-choice workflow responsive even when an upstream
          // image provider is unavailable. A fallback PNG is still persisted
          // after the bounded attempt.
          timeoutMs: Math.min(policy.timeout_ms ?? 180_000, 90_000)
        });
        const firstImage = image.images[0];
        if (!firstImage) {
          throw new Error('Image generation returned no preview image.');
        }
        concept.image = firstImage;
      } catch (error) {
        concept.imageError = error instanceof Error ? error.message : 'Image generation failed.';
        concept.warnings.push('AI preview generation failed; a deterministic PNG fallback was created for review.');
        concept.image = await this.createFallbackImage(context, variantIndex);
      }
    }));

    return {
      artifactName: 'Logo concepts',
      artifactKind: 'JSON',
      contentJson: { concepts },
      sanitizedRequest: { userInstructions: input.userInstructions, requestedCount: input.count, conceptCount: concepts.length },
      parsedResponse: { concepts },
      actualModel: policy.primary_model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostMicroUsd: 0,
      latencyMs: 0,
      persist: (manager) => this.persistConcepts(manager, job.id, job.identityVersionId, context, concepts)
    };
  }

  private async loadContext(identityVersionId: string): Promise<LogoContext> {
    const rows = await this.dataSource.query<Array<{ context_json: LogoContext }>>(
      `SELECT jsonb_build_object(
        'workspaceId', identity_projects.workspace_id,
        'projectId', identity_projects.id,
        'projectName', identity_projects.name,
        'selectedVisualDirectionId', visual_directions.id,
        'languages', COALESCE((SELECT jsonb_agg(language_code ORDER BY sort_order) FROM brand_brief_languages WHERE brand_brief_id = brand_briefs.id), '[]'::jsonb),
        'strategy', jsonb_build_object(
          'positioning', brand_strategies.positioning,
          'valueProposition', brand_strategies.value_proposition,
          'mission', brand_strategies.mission,
          'taglines', COALESCE((SELECT jsonb_agg(text ORDER BY sort_order) FROM brand_strategy_taglines WHERE brand_strategy_id = brand_strategies.id), '[]'::jsonb)
        ),
        'visualDirection', to_jsonb(visual_directions),
        'colors', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', name, 'hex', hex, 'usage', usage) ORDER BY sort_order) FROM visual_colors WHERE visual_direction_id = visual_directions.id), '[]'::jsonb),
        'fonts', COALESCE((SELECT jsonb_agg(jsonb_build_object('role', role, 'family', family, 'license_status', license_status) ORDER BY sort_order) FROM visual_fonts WHERE visual_direction_id = visual_directions.id), '[]'::jsonb)
      ) AS context_json
       FROM identity_versions
       JOIN identity_projects ON identity_projects.id = identity_versions.identity_project_id
       JOIN brand_briefs ON brand_briefs.identity_version_id = identity_versions.id AND brand_briefs.confirmed_at IS NOT NULL
       JOIN brand_strategies ON brand_strategies.identity_version_id = identity_versions.id AND brand_strategies.confirmed_at IS NOT NULL
       JOIN visual_directions ON visual_directions.identity_version_id = identity_versions.id AND visual_directions.is_selected AND visual_directions.status = 'ACTIVE'
       WHERE identity_versions.id = $1`,
      [identityVersionId]
    );

    const context = rows[0]?.context_json;
    if (!context?.selectedVisualDirectionId) {
      throw new Error('Select a visual direction before generating logo concepts.');
    }
    return context;
  }

  private async createFallbackImage(context: LogoContext, variantIndex: number): Promise<IngestedImage> {
    const primary = context.colors.find((color) => `${color.name} ${color.usage ?? ''}`.toLowerCase().includes('primary'))?.hex ?? context.colors[0]?.hex ?? '#111827';
    const accent = context.colors.find((color) => `${color.name} ${color.usage ?? ''}`.toLowerCase().includes('accent'))?.hex ?? context.colors[1]?.hex ?? '#06B6D4';
    const initials = context.projectName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'BR';
    const png = createFallbackPng(primary, accent, variantIndex, initials, context.projectName);
    const stored = await this.storage.putImage(png, 'png');
    return {
      storageKey: stored.key,
      checksumSha256: stored.checksumSha256,
      byteSize: stored.byteSize,
      mimeType: 'image/png',
      width: 1200,
      height: 700
    };
  }

  private planConcepts(
    context: LogoContext,
    count: number,
    languageCodes: string[],
    useCase: string,
    userInstructions: string
  ): LogoConceptSpec[] {
    const languages = languageCodes.length ? languageCodes : context.languages;
    const palette = context.colors.map((color) => `${color.name} ${color.hex}`).join(', ') || 'the selected brand palette';
    const fontWarnings = context.fonts
      .filter((font) => font.license_status !== 'OPEN')
      .map((font) => `Font ${font.family} license is ${font.license_status}; verify before production use.`);
    const baseWarnings = [
      'Trademark search is required before production use.',
      'Vector cleanup and small-size optical review are required before production use.',
      ...fontWarnings
    ];
    const templates: Array<Pick<LogoConceptSpec, 'type' | 'name' | 'rationale'>> = [
      {
        type: 'COMBINATION',
        name: `${context.projectName} strategic lockup`,
        rationale: 'Combines a distinctive abstract mark with a readable name treatment to balance memorability and clarity.'
      },
      {
        type: 'SYMBOL',
        name: `${context.projectName} signal symbol`,
        rationale: 'Uses a simple abstract symbol that can scale into app icons, favicons, and social avatars.'
      },
      {
        type: 'WORDMARK',
        name: `${context.projectName} custom wordmark`,
        rationale: 'Prioritizes typography and spacing for a clear, ownable name-led identity.'
      },
      {
        type: 'LETTERMARK',
        name: `${context.projectName} initials mark`,
        rationale: 'Condenses the brand into a compact monogram system for constrained spaces.'
      },
      {
        type: 'EMBLEM',
        name: `${context.projectName} trust emblem`,
        rationale: 'Frames the brand in a contained badge-like composition for authority and certification moments.'
      }
    ];

    const conceptDirections: Record<LogoConceptSpec['type'], string> = {
      COMBINATION:
        'Use a horizontal three-step workflow motif with connected nodes and directional arrows beside the exact brand name. The mark should communicate reliable automation and orchestration.',
      SYMBOL:
        'Use a standalone geometric signal mark built from a connected W-shaped flow path and three or more nodes. It must work as an app icon without relying on text.',
      WORDMARK:
        'Use a typography-first wordmark with the exact brand name, disciplined spacing, a single precision rule, and one electric accent. Do not substitute a random icon or illustration.',
      LETTERMARK:
        'Use a compact monogram made from the brand initials and connected process lines. Keep it legible at favicon size and avoid decorative badges.',
      EMBLEM:
        'Use a restrained precision badge with a central workflow symbol, thin geometry, and the exact brand name. Avoid ornamental seals or unrelated imagery.'
    };

    return templates.slice(0, count).map((template) => ({
      ...template,
      languageCodes: languages,
      warnings: [...baseWarnings],
      prompt: [
        `Create an original ${template.type.toLowerCase()} logo concept for ${context.projectName}.`,
        `Use case: ${useCase}.`,
        `Strategic grounding: ${JSON.stringify(context.strategy)}.`,
        `Visual direction: ${JSON.stringify(context.visualDirection)}.`,
        `Concept direction: ${conceptDirections[template.type]}`,
        `Palette: ${palette}.`,
        'Use abstract geometry and brand attributes only. Do not copy or imitate any named logo, trademark, or existing brand asset.',
        `Render the exact brand text "${context.projectName}" where this concept calls for text. Flat vector-like PNG logo board on a clean solid background, high contrast, no mockup, no photorealism, no stock imagery, no unrelated symbols, no watermarks.`,
        languages.length ? `Language/script considerations: ${languages.join(', ')}.` : '',
        userInstructions ? `User instructions: ${userInstructions}.` : ''
      ]
        .filter(Boolean)
        .join(' ')
    }));
  }

  private async persistConcepts(
    manager: Pick<DataSource['manager'], 'query'>,
    generationJobId: string,
    identityVersionId: string,
    context: LogoContext,
    concepts: LogoConceptSpec[]
  ) {
    for (const [index, concept] of concepts.entries()) {
      const conceptRows = await manager.query<Array<{ id: string }>>(
        `INSERT INTO logo_concepts (
          identity_version_id, visual_direction_id, generation_job_id, type, status, review_status,
          name, rationale, language_codes, prompt, review_warnings, metadata
        )
        VALUES ($1, $2, $3, $4, 'DRAFT', 'REVIEW_REQUIRED', $5, $6, $7, $8, $9::jsonb, $10::jsonb)
        RETURNING id`,
        [
          identityVersionId,
          context.selectedVisualDirectionId,
          generationJobId,
          concept.type,
          concept.name,
          concept.rationale,
          concept.languageCodes,
          concept.prompt,
          JSON.stringify(concept.warnings),
          JSON.stringify({ sortOrder: index, imageError: concept.imageError ?? null })
        ]
      );
      const conceptId = conceptRows[0]?.id as string;

      if (concept.image) {
        const assetRows = await manager.query<Array<{ id: string }>>(
          `INSERT INTO brand_assets (
            workspace_id, identity_project_id, identity_version_id, visual_direction_id,
            category, source, status, visibility, object_key, original_filename, display_name, alt_text,
            declared_mime_type, detected_mime_type, declared_byte_size, actual_byte_size, checksum_sha256,
            scan_status, uploaded_at, processed_at, available_at, upload_expires_at, metadata
          )
          VALUES ($1, $2, $3, $4, 'LOGO_CONCEPT', 'AI_GENERATED', 'AVAILABLE', 'PRIVATE', $5, $6, $7, $8,
                  $9, $9, $10, $10, $11, 'PASSED', now(), now(), now(), now(), $12::jsonb)
          RETURNING id`,
          [
            context.workspaceId,
            context.projectId,
            identityVersionId,
            context.selectedVisualDirectionId,
            concept.image.storageKey,
            `${concept.name}.png`,
            concept.name,
            `${concept.name} logo concept preview`,
            concept.image.mimeType,
            concept.image.byteSize,
            concept.image.checksumSha256,
            JSON.stringify({ reviewRequired: true, productionReady: false })
          ]
        );
        const assetId = assetRows[0]?.id as string;
        await manager.query(
          `INSERT INTO asset_variants (
            brand_asset_id, kind, object_key, mime_type, byte_size, checksum_sha256, width, height, metadata
          )
          VALUES ($1, 'ORIGINAL', $2, $3, $4, $5, $6, $7, '{}'::jsonb)
          ON CONFLICT (brand_asset_id, kind) DO NOTHING`,
          [
            assetId,
            concept.image.storageKey,
            concept.image.mimeType,
            concept.image.byteSize,
            concept.image.checksumSha256,
            concept.image.width ?? null,
            concept.image.height ?? null
          ]
        );
        await manager.query(
          `INSERT INTO logo_concept_assets (logo_concept_id, brand_asset_id, role, sort_order)
           VALUES ($1, $2, 'preview', 0)
           ON CONFLICT DO NOTHING`,
          [conceptId, assetId]
        );
      }
    }
  }
}

function createFallbackPng(primaryHex: string, accentHex: string, variantIndex: number, initials: string, projectName: string): Buffer {
  const width = 1200;
  const height = 700;
  const primary = parseHex(primaryHex, [17, 24, 39]);
  const accent = parseHex(accentHex, [6, 182, 212]);
  const white: Rgb = [249, 250, 251];
  const ink: Rgb = [17, 24, 39];
  const background: Rgb = variantIndex === 2 ? white : primary;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const color = background;
      const pixel = row + 1 + x * 4;
      raw[pixel] = color[0];
      raw[pixel + 1] = color[1];
      raw[pixel + 2] = color[2];
      raw[pixel + 3] = 255;
    }
  }

  const draw = createRasterDrawer(raw, width, height);
  const foreground = variantIndex === 2 ? ink : white;
  const normalizedName = projectName.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
  const nameParts = normalizedName.split(/\s+FOR\s+/);
  const brandLabel = nameParts[0]?.slice(0, 14) || initials;
  const descriptor = nameParts[1] ? `FOR ${nameParts[1].slice(0, 18)}` : 'AUTOMATION';
  const label = `${brandLabel} ${descriptor}`;

  if (variantIndex === 0) {
    // Strategic lockup: a three-step automation flow paired with a readable name.
    draw.line([300, 265], [470, 265], accent, 12);
    draw.line([730, 265], [900, 265], accent, 12);
    for (const [x, y] of [[300, 265], [600, 265], [900, 265]] as const) {
      draw.circle(x, y, 56, background, accent, 10);
      draw.circle(x, y, 13, accent);
    }
    draw.arrow(470, 265, 555, 265, accent);
    draw.arrow(645, 265, 730, 265, accent);
    draw.textCentered(label, 600, 405, foreground, 7, 5);
    draw.textCentered('AUTOMATION FLOW', 600, 470, accent, 4, 4);
  } else if (variantIndex === 1) {
    // Signal symbol: a distinctive W-shaped flow path with connected nodes.
    const points: Array<[number, number]> = [[350, 215], [425, 405], [520, 285], [600, 430], [680, 285], [775, 405], [850, 215]];
    for (let index = 1; index < points.length; index += 1) draw.line(points[index - 1]!, points[index]!, accent, 24);
    for (const [x, y] of points) {
      draw.circle(x, y, 27, background, white, 7);
      draw.circle(x, y, 9, accent);
    }
    draw.textCentered(initials, 600, 520, white, 8, 6);
    draw.textCentered('CONNECTED / CAPABLE', 600, 590, accent, 4, 4);
  } else {
    // Wordmark: a name-led lockup with a precision rule and three signal blocks.
    draw.textCentered(label, 600, 285, ink, 7, 5);
    draw.line([330, 380], [870, 380], accent, 8);
    draw.rect(430, 430, 72, 72, accent);
    draw.rect(564, 430, 72, 72, ink);
    draw.rect(698, 430, 72, 72, accent);
    draw.textCentered(descriptor, 600, 570, ink, 4, 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

type Rgb = [number, number, number];

function createRasterDrawer(raw: Buffer, width: number, height: number) {
  const setPixel = (x: number, y: number, color: Rgb) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * (width * 4 + 1) + 1 + x * 4;
    raw[pixel] = color[0];
    raw[pixel + 1] = color[1];
    raw[pixel + 2] = color[2];
    raw[pixel + 3] = 255;
  };
  const rect = (x: number, y: number, rectWidth: number, rectHeight: number, color: Rgb) => {
    for (let row = y; row < y + rectHeight; row += 1) {
      for (let column = x; column < x + rectWidth; column += 1) setPixel(column, row, color);
    }
  };
  const line = (from: [number, number], to: [number, number], color: Rgb, thickness = 1) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(from[0] + (dx * step) / Math.max(steps, 1));
      const y = Math.round(from[1] + (dy * step) / Math.max(steps, 1));
      for (let offsetX = -Math.floor(thickness / 2); offsetX <= Math.ceil(thickness / 2); offsetX += 1) {
        for (let offsetY = -Math.floor(thickness / 2); offsetY <= Math.ceil(thickness / 2); offsetY += 1) setPixel(x + offsetX, y + offsetY, color);
      }
    }
  };
  const circle = (centerX: number, centerY: number, radius: number, fill: Rgb, stroke?: Rgb, strokeWidth = 1) => {
    const outer = radius * radius;
    const inner = Math.max(0, radius - strokeWidth) ** 2;
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        const distance = (x - centerX) ** 2 + (y - centerY) ** 2;
        if (distance <= outer) setPixel(x, y, stroke && distance >= inner ? stroke : fill);
      }
    }
  };
  const arrow = (fromX: number, fromY: number, toX: number, toY: number, color: Rgb) => {
    line([fromX, fromY], [toX, toY], color, 10);
    line([toX, toY], [toX - 28, toY - 20], color, 10);
    line([toX, toY], [toX - 28, toY + 20], color, 10);
  };
  const text = (value: string, x: number, y: number, color: Rgb, scale: number, spacing: number) => {
    const glyphs = value.split('');
    const cursorWidth = 6 * scale + spacing;
    for (const [index, glyph] of glyphs.entries()) drawGlyph(glyph, x + index * cursorWidth, y, color, scale, setPixel);
  };
  const textCentered = (value: string, centerX: number, y: number, color: Rgb, scale: number, spacing: number) => {
    const totalWidth = Math.max(0, value.length * (6 * scale + spacing) - spacing);
    text(value, Math.round(centerX - totalWidth / 2), y, color, scale, spacing);
  };
  return { rect, line, circle, arrow, text, textCentered };
}

const GLYPHS: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110']
};

function drawGlyph(value: string, x: number, y: number, color: Rgb, scale: number, setPixel: (x: number, y: number, color: Rgb) => void) {
  const glyph = GLYPHS[value] ?? GLYPHS[' '];
  if (!glyph) return;
  for (const [row, bits] of glyph.entries()) {
    for (const [column, bit] of bits.split('').entries()) {
      if (bit === '1') {
        for (let offsetY = 0; offsetY < scale; offsetY += 1) {
          for (let offsetX = 0; offsetX < scale; offsetX += 1) setPixel(x + column * scale + offsetX, y + row * scale + offsetY, color);
        }
      }
    }
  }
}

function parseHex(value: string, fallback: [number, number, number]): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return fallback;
  const hex = match[1] ?? '';
  return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
