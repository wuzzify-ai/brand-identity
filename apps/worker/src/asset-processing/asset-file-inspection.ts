import { createHash } from 'crypto';

export type AssetInspection = {
  checksumSha256: string;
  byteSize: number;
  detectedMimeType: string;
  width: number | null;
  height: number | null;
};

export function inspectAsset(buffer: Buffer): AssetInspection {
  const detectedMimeType = detectMimeType(buffer);
  const dimensions = detectDimensions(buffer, detectedMimeType);

  return {
    checksumSha256: createHash('sha256').update(buffer).digest('hex'),
    byteSize: buffer.byteLength,
    detectedMimeType,
    width: dimensions.width,
    height: dimensions.height
  };
}

export function assertSafeAsset(buffer: Buffer, detectedMimeType: string): void {
  const content = buffer.toString('utf8');
  if (content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
    throw new Error('Malware test signature detected.');
  }

  if (detectedMimeType === 'image/svg+xml') {
    const lower = content.toLowerCase();
    const unsafeMarkers = ['<script', 'javascript:', 'onload=', 'onerror=', '<foreignobject', 'href="http:', "href='http:", 'href="https:', "href='https:"];
    if (unsafeMarkers.some((marker) => lower.includes(marker))) {
      throw new Error('Unsafe SVG content detected.');
    }
  }
}

export function mimeMatchesDeclared(declaredMimeType: string, detectedMimeType: string): boolean {
  return declaredMimeType.toLowerCase() === detectedMimeType.toLowerCase();
}

function detectMimeType(buffer: Buffer): string {
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

function detectDimensions(buffer: Buffer, mimeType: string): { width: number | null; height: number | null } {
  if (mimeType === 'image/png' && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === 'image/gif' && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (mimeType === 'image/jpeg') {
    return readJpegDimensions(buffer);
  }
  if (mimeType === 'image/svg+xml') {
    return readSvgDimensions(buffer.toString('utf8'));
  }

  return { width: null, height: null };
}

function readJpegDimensions(buffer: Buffer): { width: number | null; height: number | null } {
  let offset = 2;
  while (offset < buffer.length) {
    if (offset + 3 >= buffer.length) return { width: null, height: null };
    if (buffer[offset] !== 0xff) return { width: null, height: null };
    const marker = buffer[offset + 1] as number;
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < buffer.length) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }

  return { width: null, height: null };
}

function readSvgDimensions(svg: string): { width: number | null; height: number | null } {
  const width = readSvgNumber(svg, 'width');
  const height = readSvgNumber(svg, 'height');
  if (width && height) {
    return { width, height };
  }

  const viewBox = svg.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  return {
    width: viewBox?.[1] ? Math.round(Number(viewBox[1])) : null,
    height: viewBox?.[2] ? Math.round(Number(viewBox[2])) : null
  };
}

function readSvgNumber(svg: string, attribute: 'width' | 'height'): number | null {
  const match = svg.match(new RegExp(`${attribute}=["']([\\d.]+)(?:px)?["']`, 'i'));
  return match?.[1] ? Math.round(Number(match[1])) : null;
}
