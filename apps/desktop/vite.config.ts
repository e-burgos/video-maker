import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: '../../node_modules/.vite/desktop',
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/apps/desktop',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main/main.ts'],
      thresholds: { statements: 80, lines: 80, functions: 80, branches: 80 },
    },
  },
});
