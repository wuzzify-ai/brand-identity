import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@wuzzify/brand-contracts': fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.spec.ts', 'test/**/*.spec.tsx'],
    setupFiles: ['test/setup.ts']
  }
});
