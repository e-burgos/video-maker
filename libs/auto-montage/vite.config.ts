import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/auto-montage',
  resolve: {
    alias: {
      '@video-maker/timeline-core': fileURLToPath(
        new URL('../timeline-core/src/index.ts', import.meta.url),
      ),
      '@video-maker/media-local': fileURLToPath(
        new URL('../media-local/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/libs/auto-montage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/__fixtures__/**',
        'src/index.ts',
        'src/fs/node-*',
        'src/smoke.ts',
      ],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
