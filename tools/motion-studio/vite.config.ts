import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/motion-studio',
  resolve: {
    alias: {
      '@video-maker/timeline-core': fileURLToPath(new URL('../../libs/timeline-core/src/index.ts', import.meta.url)),
      '@video-maker/media-local': fileURLToPath(new URL('../../libs/media-local/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/tools/motion-studio',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/__fixtures__/**', 'src/main.ts', 'src/deps/node-motion-dependencies.ts', 'src/deps/motion-dependencies.ts', 'src/template/motion-timeline.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
