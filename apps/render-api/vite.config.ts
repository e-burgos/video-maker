import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: '../../node_modules/.vite/render-api',
  resolve: {
    alias: {
      '@video-maker/auto-montage': fileURLToPath(
        new URL('../../libs/auto-montage/src/index.ts', import.meta.url),
      ),
      '@video-maker/composition-remotion/render': fileURLToPath(
        new URL('../../libs/composition-remotion/src/render.ts', import.meta.url),
      ),
      '@video-maker/media-local': fileURLToPath(
        new URL('../../libs/media-local/src/index.ts', import.meta.url),
      ),
      '@video-maker/local-store': fileURLToPath(
        new URL('../../libs/local-store/src/index.ts', import.meta.url),
      ),
      '@video-maker/timeline-core': fileURLToPath(
        new URL('../../libs/timeline-core/src/index.ts', import.meta.url),
      ),
      '@video-maker/motion-graphics': fileURLToPath(
        new URL('../../libs/motion-graphics/src/index.ts', import.meta.url),
      ),
      '@video-maker/producer-tools': fileURLToPath(
        new URL('../../libs/producer-tools/src/index.ts', import.meta.url),
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
      reportsDirectory: '../../coverage/apps/render-api',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/__fixtures__/**',
        'src/main.ts',
        'src/deps/node-render-api-dependencies.ts',
      ],
      thresholds: { statements: 80, lines: 80, functions: 80, branches: 80 },
    },
  },
});
