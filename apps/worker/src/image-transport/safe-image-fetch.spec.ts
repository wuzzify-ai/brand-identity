import { describe, expect, it } from 'vitest';
import { fetchImageSafely } from './safe-image-fetch.js';

describe('fetchImageSafely', () => {
  it('rejects private/link-local targets before fetching', async () => {
    await expect(fetchImageSafely('http://127.0.0.1/image.png')).rejects.toThrow(
      'Image URL resolves to a private or link-local address.'
    );
  });

  it('rejects wrong MIME and oversize responses', async () => {
    await expect(
      fetchImageSafely(
        'https://example.com/file.txt',
        async () => new Response('nope', { headers: { 'content-type': 'text/plain' } })
      )
    ).rejects.toThrow('Unsupported image MIME type');

    await expect(
      fetchImageSafely(
        'https://example.com/huge.png',
        async () => new Response('x', { headers: { 'content-type': 'image/png', 'content-length': String(13 * 1024 * 1024) } })
      )
    ).rejects.toThrow('Image exceeds maximum allowed size.');
  });
});
