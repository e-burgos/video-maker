import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/render-cli',
  resolve: {
    alias: {
      '@video-maker/composition-remotion/render': fileURLToPath(
        new URL('../../libs/composition-remotion/src/render.ts', import.meta.url),
      ),
      '@video-maker/timeline-core': fileURLToPath(
        new URL('../../libs/timeline-core/src/index.ts', import.meta.url),
      ),
      '@video-maker/media-local': fileURLToPath(
        new URL('../../libs/media-local/src/index.ts', import.meta.url),
      ),
      '@video-maker/auto-montage': fileURLToPath(
        new URL('../../libs/auto-montage/src/index.ts', import.meta.url),
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
      reportsDirectory: '../../coverage/tools/render-cli',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/__fixtures__/**',
        'src/main.ts',
        'src/deps/node-cli-dependencies.ts',
      ],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
