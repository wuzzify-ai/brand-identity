import { mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterImageTransport } from './openrouter-image-transport.js';
import { PrivateObjectStorage } from './private-object-storage.js';

let storageDir: string | null = null;

afterEach(async () => {
  if (storageDir) {
    await rm(storageDir, { recursive: true, force: true });
    storageDir = null;
  }
  vi.restoreAllMocks();
});

function pngBase64() {
  return Buffer.from('fake-png').toString('base64');
}

async function makeTransport(fetcher: typeof fetch) {
  storageDir = join(tmpdir(), `brand-image-test-${crypto.randomUUID()}`);
  await mkdir(storageDir, { recursive: true });
  vi.stubGlobal('fetch', fetcher);
  const config = new ConfigService({
    OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1',
    OPENROUTER_API_KEY: 'test-key',
    S3_ENDPOINT: `file://${storageDir}`
  });
  return new OpenRouterImageTransport(config, new PrivateObjectStorage(config));
}

describe('OpenRouterImageTransport', () => {
  it('fails unsupported parameters before paid generation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'image-model', sizes: ['1024x1024'], formats: ['png'], max_images: 1, supports_transparency: false }]
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    );
    const transport = await makeTransport(fetcher);

    await expect(
      transport.generate({
        prompt: 'logo',
        models: ['image-model'],
        userKey: 'job',
        size: '2048x2048',
        count: 1,
        format: 'png'
      })
    ).rejects.toThrow('Unsupported image size');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('ingests base64 image output into owned storage', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: 'image-model', sizes: ['1024x1024'], formats: ['png'], max_images: 2, supports_transparency: true }]
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: 'image-model',
            provider: 'openai',
            data: [{ b64_json: pngBase64() }],
            usage: { cost: 0.01 }
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      );
    const transport = await makeTransport(fetcher);
    const result = await transport.generate({
      prompt: 'logo',
      models: ['image-model'],
      userKey: 'job',
      size: '1024x1024',
      count: 1,
      format: 'png',
      transparentBackground: true
    });

    expect(result.images[0]?.storageKey).toMatch(/^generated\//);
    expect(result.images[0]?.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.actualProvider).toBe('openai');
    expect(result.estimatedCostMicroUsd).toBe(10000);
  });
});
