import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/motion-graphics',
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/libs/motion-graphics',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/__fixtures__/**', 'src/index.ts', 'src/template/motion-timeline.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
