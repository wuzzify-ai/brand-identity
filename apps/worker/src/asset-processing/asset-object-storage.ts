import { readFile } from 'fs/promises';
import { isAbsolute, join, normalize, resolve } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AssetObjectStorage {
  constructor(private readonly config: ConfigService) {}

  async readObject(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
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
