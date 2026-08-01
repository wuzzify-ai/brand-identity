const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']);

export function assertAllowedMimeType(mimeType: string): void {
  if (!allowedMimeTypes.has(mimeType.toLowerCase())) {
    throw new Error(`Unsupported asset MIME type: ${mimeType}`);
  }
}

export function detectMimeType(buffer: Buffer): string {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return 'image/gif';
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }

  const prefix = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').trimStart().toLowerCase();
  if (prefix.startsWith('<svg') || prefix.startsWith('<?xml')) {
    return 'image/svg+xml';
  }

  return 'application/octet-stream';
}

export function mimeMatchesDeclared(declaredMimeType: string, detectedMimeType: string): boolean {
  if (declaredMimeType.toLowerCase() === detectedMimeType.toLowerCase()) {
    return true;
  }

  return declaredMimeType.toLowerCase() === 'image/svg+xml' && detectedMimeType === 'image/svg+xml';
}
