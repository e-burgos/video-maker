import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/timeline-core',
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/libs/timeline-core',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/__fixtures__/**', 'src/index.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
