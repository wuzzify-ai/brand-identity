import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, normalize, resolve } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

export type StoredAssetObject = {
  key: string;
  byteSize: number;
  checksumSha256: string;
};

@Injectable()
export class PrivateAssetStorage {
  constructor(private readonly config: ConfigService) {}

  async putRequestBody(key: string, request: Request, maxBytes: number): Promise<StoredAssetObject> {
    const chunks: Buffer[] = [];
    let byteSize = 0;

    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteSize += buffer.byteLength;

      if (byteSize > maxBytes) {
        throw new Error('Uploaded object exceeds the maximum allowed size.');
      }

      chunks.push(buffer);
    }

    const body = Buffer.concat(chunks);
    const checksumSha256 = createHash('sha256').update(body).digest('hex');
    await this.writeObject(key, body);
    return { key, byteSize, checksumSha256 };
  }

  async readObject(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async objectStats(key: string): Promise<{ byteSize: number }> {
    const result = await stat(this.resolveKey(key));
    return { byteSize: result.size };
  }

  streamObject(key: string, response: Response, mimeType: string, filename: string): void {
    const safeFilename = filename.replace(/["\r\n]/g, '_');
    response.setHeader('Content-Type', mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    createReadStream(this.resolveKey(key)).pipe(response);
  }

  async writeObject(key: string, buffer: Buffer): Promise<void> {
    const fullPath = this.resolveKey(key);
    const tempPath = `${fullPath}.tmp-${process.pid}-${Date.now()}`;
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(tempPath, buffer);
    await rename(tempPath, fullPath);
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<StoredAssetObject> {
    const buffer = await this.readObject(sourceKey);
    await this.writeObject(destinationKey, buffer);
    return {
      key: destinationKey,
      byteSize: buffer.byteLength,
      checksumSha256: createHash('sha256').update(buffer).digest('hex')
    };
  }

  async deleteObjectIfExists(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private resolveKey(key: string): string {
    if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) {
      throw new Error('Unsafe storage key.');
    }

    const base = this.storageBasePath();
    const fullPath = normalize(join(base, key));
    if (!fullPath.startsWith(normalize(base))) {
      throw new Error('Unsafe storage key.');
    }

    return fullPath;
  }

  private storageBasePath(): string {
    const endpoint = this.config.get<string>('S3_ENDPOINT') ?? 'file://./.local-object-storage';
    const configuredPath = endpoint.startsWith('file://') ? endpoint.replace('file://', '') || '../../.local-object-storage' : '../../.local-object-storage';
    return isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
  }
}
