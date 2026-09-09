import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/composition-remotion',
  plugins: [react()],
  resolve: {
    alias: {
      '@video-maker/timeline-core': fileURLToPath(
        new URL('../timeline-core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/libs/composition-remotion',
      include: [
        'src/helpers/**/*.ts',
        'src/transitions/**/*.ts',
        'src/render.ts',
        'src/components/timeline-video.tsx',
        'src/components/video-backend.tsx',
      ],
      exclude: ['src/**/*.spec.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
