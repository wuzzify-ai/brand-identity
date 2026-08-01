export interface ImageModelCapability {
  id: string;
  supportedParameters: string[];
  sizes: string[];
  formats: string[];
  maxImages: number;
  supportsTransparency: boolean;
  supportsSeed: boolean;
  supportsReferences: boolean;
}

export interface ImageGenerationRequest {
  prompt: string;
  models: string[];
  userKey: string;
  size: string;
  count: number;
  format: 'png' | 'jpeg' | 'webp';
  transparentBackground?: boolean;
  seed?: number;
  referenceImageUrls?: string[];
  requestParameters?: Record<string, unknown>;
  providerPreferences?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface IngestedImage {
  storageKey: string;
  checksumSha256: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
}

export interface ImageGenerationResult {
  images: IngestedImage[];
  actualModel?: string;
  actualProvider?: string;
  estimatedCostMicroUsd: number;
  latencyMs: number;
  sanitizedRequest: Record<string, unknown>;
}
