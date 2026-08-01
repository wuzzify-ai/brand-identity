import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(configDir, '../..'),
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/brand-identity-assets/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.wuzzify.local',
        pathname: '/brand-identity-assets/**'
      }
    ]
  }
};

export default nextConfig;
