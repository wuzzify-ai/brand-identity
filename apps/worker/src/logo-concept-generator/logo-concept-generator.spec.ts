import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { LogoConceptGenerator } from './logo-concept-generator.js';

describe('LogoConceptGenerator', () => {
  it('preserves concept text when preview image generation fails', async () => {
    const generator = new LogoConceptGenerator(
      {
        resolve: async () => ({
          primary_model: 'test/logo-image',
          fallback_models: [],
          request_parameters: { size: '1024x1024', output_format: 'png' },
          provider_preferences: {},
          timeout_ms: 1000
        })
      } as never,
      {
        generate: async () => {
          throw new Error('provider unavailable');
        }
      } as never,
      {} as never,
      {
        query: async () => [
          {
            context_json: {
              workspaceId: 'workspace-id',
              projectId: 'project-id',
              projectName: 'Nimbus',
              selectedVisualDirectionId: 'visual-id',
              languages: ['en', 'ar'],
              strategy: { positioning: 'clear' },
              visualDirection: { name: 'Calm system' },
              colors: [{ name: 'Primary', hex: '#0F766E', usage: 'Primary' }],
              fonts: [{ role: 'heading', family: 'Inter', license_status: 'OPEN' }]
            }
          }
        ]
      } as never,
      {
        putImage: async (buffer: Buffer, extension: string) => ({
          key: `generated/test.${extension}`,
          checksumSha256: createHash('sha256').update(buffer).digest('hex'),
          byteSize: buffer.byteLength
        })
      } as never
    );

    const result = await generator.generate({
      id: 'job-id',
      identityVersionId: 'version-id',
      workflowStageKey: 'ASSETS',
      task: 'LOGO_CONCEPTS_GENERATE',
      tier: 'BALANCED',
      input: { count: 1 }
    });

    const concept = (result.contentJson.concepts as Array<{ name: string; imageError?: string; warnings: string[] }>)[0];
    expect((result.contentJson.concepts as unknown[]).length).toBe(3);

    expect(concept?.name).toContain('Nimbus');
    expect(concept?.imageError).toBe('provider unavailable');
    expect(concept?.warnings.join(' ')).toContain('Trademark search');
    const images = (result.contentJson.concepts as Array<{ image?: { mimeType?: string; storageKey?: string; checksumSha256?: string } }>).map((item) => item.image);
    expect(images.every((image) => image?.mimeType === 'image/png' && image.storageKey?.endsWith('.png'))).toBe(true);
    expect(new Set(images.map((image) => image?.checksumSha256)).size).toBe(3);
  });
});
