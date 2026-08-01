import { isIP } from 'net';
import { lookup } from 'dns/promises';

const maxImageBytes = 12 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function fetchImageSafely(url: string, fetcher: typeof fetch = fetch) {
  const parsed = new URL(url);

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Image URL must use HTTP(S).');
  }

  await assertPublicHostname(parsed.hostname);

  const response = await fetcher(parsed, {
    signal: AbortSignal.timeout(20_000),
    redirect: 'error'
  });

  if (!response.ok) {
    throw new Error(`Image fetch failed with ${response.status}.`);
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.toLowerCase() ?? '';

  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error(`Unsupported image MIME type: ${mimeType || 'unknown'}.`);
  }

  const length = Number(response.headers.get('content-length') ?? '0');

  if (length > maxImageBytes) {
    throw new Error('Image exceeds maximum allowed size.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength > maxImageBytes) {
    throw new Error('Image exceeds maximum allowed size.');
  }

  return { buffer, mimeType };
}

async function assertPublicHostname(hostname: string): Promise<void> {
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });

  for (const { address } of addresses) {
    if (!isPublicIp(address)) {
      throw new Error('Image URL resolves to a private or link-local address.');
    }
  }
}

function isPublicIp(address: string): boolean {
  if (address === '127.0.0.1' || address === '::1') return false;
  if (address.startsWith('10.') || address.startsWith('192.168.')) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return false;
  if (address.startsWith('169.254.') || address.toLowerCase().startsWith('fe80:')) return false;
  if (address === '0.0.0.0' || address === '::') return false;
  return true;
}
