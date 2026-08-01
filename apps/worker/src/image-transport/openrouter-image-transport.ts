import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchImageSafely } from './safe-image-fetch.js';
import { PrivateObjectStorage } from './private-object-storage.js';
import type { ImageGenerationRequest, ImageGenerationResult, ImageModelCapability } from './image-types.js';

type ModelsCache = {
  expiresAt: number;
  models: Map<string, ImageModelCapability>;
};

@Injectable()
export class OpenRouterImageTransport {
  private cache: ModelsCache | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: PrivateObjectStorage
  ) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startedAt = Date.now();
    const capabilities = await this.getCapabilities();
    const primaryCapability = capabilities.get(request.models[0] ?? '');

    if (!primaryCapability) {
      throw new Error(`Image model is not available: ${request.models[0] ?? 'none'}.`);
    }

    this.validateRequest(request, primaryCapability);

    const body = {
      ...(request.requestParameters ?? {}),
      model: request.models[0],
      models: request.models,
      prompt: request.prompt,
      n: request.count,
      size: request.size,
      response_format: 'url',
      output_format: request.format,
      background: request.transparentBackground ? 'transparent' : undefined,
      seed: request.seed,
      user: stableUserHash(request.userKey),
      provider: {
        ...(request.providerPreferences ?? {}),
        require_parameters: true
      }
    };
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(request.timeoutMs ?? 180_000)
    });
    const json = (await response.json()) as {
      model?: string;
      provider?: string;
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
      usage?: { cost?: number };
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(json.error?.message ?? `OpenRouter image request failed with ${response.status}.`);
    }

    const images = [];

    for (const item of json.data ?? []) {
      const fetched = item.b64_json
        ? { buffer: Buffer.from(item.b64_json, 'base64'), mimeType: `image/${request.format}` }
        : item.url
          ? await fetchImageSafely(item.url)
          : null;

      if (!fetched) {
        throw new Error('OpenRouter returned an image item without URL or base64 data.');
      }

      const stored = await this.storage.putImage(fetched.buffer, extensionFromMime(fetched.mimeType));
      images.push({
        storageKey: stored.key,
        checksumSha256: stored.checksumSha256,
        byteSize: stored.byteSize,
        mimeType: fetched.mimeType
      });
    }

    if (images.length !== request.count) {
      throw new Error('OpenRouter returned a different image count than requested.');
    }

    return {
      images,
      ...(json.model ? { actualModel: json.model } : {}),
      ...(json.provider ? { actualProvider: json.provider } : {}),
      estimatedCostMicroUsd: Math.round((json.usage?.cost ?? 0) * 1_000_000),
      latencyMs: Date.now() - startedAt,
      sanitizedRequest: { ...body, prompt: '[REDACTED_PROMPT]' }
    };
  }

  async getCapabilities(): Promise<Map<string, ImageModelCapability>> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.models;
    }

    const response = await fetch(`${this.baseUrl}/images/models`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(20_000)
    });
    const json = (await response.json()) as {
      data?: Array<{
        id: string;
        supported_parameters?: string[];
        sizes?: string[];
        formats?: string[];
        max_images?: number;
        supports_transparency?: boolean;
        supports_seed?: boolean;
        supports_references?: boolean;
      }>;
    };

    if (!response.ok) {
      throw new Error('Failed to load OpenRouter image model capabilities.');
    }

    const models = new Map<string, ImageModelCapability>();

    for (const model of json.data ?? []) {
      models.set(model.id, {
        id: model.id,
        supportedParameters: model.supported_parameters ?? [],
        sizes: model.sizes ?? ['1024x1024'],
        formats: model.formats ?? ['png'],
        maxImages: model.max_images ?? 1,
        supportsTransparency: model.supports_transparency ?? false,
        supportsSeed: model.supports_seed ?? false,
        supportsReferences: model.supports_references ?? false
      });
    }

    this.cache = { expiresAt: Date.now() + 10 * 60 * 1000, models };
    return models;
  }

  private validateRequest(request: ImageGenerationRequest, capability: ImageModelCapability): void {
    if (!capability.sizes.includes(request.size)) throw new Error(`Unsupported image size: ${request.size}.`);
    if (!capability.formats.includes(request.format)) throw new Error(`Unsupported image format: ${request.format}.`);
    if (request.count < 1 || request.count > capability.maxImages) throw new Error('Unsupported image count.');
    if (request.transparentBackground && !capability.supportsTransparency) throw new Error('Model does not support transparency.');
    if (request.seed !== undefined && !capability.supportsSeed) throw new Error('Model does not support seed.');
    if (request.referenceImageUrls?.length && !capability.supportsReferences) throw new Error('Model does not support reference images.');
  }

  private get baseUrl(): string {
    return this.config.get<string>('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1';
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.config.getOrThrow<string>('OPENROUTER_API_KEY')}`,
      'Content-Type': 'application/json'
    };
  }
}

function stableUserHash(userKey: string): string {
  return `u_${createHash('sha256').update(userKey).digest('hex').slice(0, 32)}`;
}

function extensionFromMime(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}
