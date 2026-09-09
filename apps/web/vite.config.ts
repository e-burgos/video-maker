import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const projectRoot = __dirname;
const renderApiUrl = process.env['RENDER_API_URL'] ?? 'http://127.0.0.1:4310';

export default defineConfig({
  root: projectRoot,
  cacheDir: '../../node_modules/.vite/web',
  base: process.env['VITE_BASE_PATH'] ?? '/',
  plugins: [tailwindcss(), react()],
  server: {
    port: Number(process.env['WEB_PORT'] ?? process.env['PORT'] ?? 4200),
    host: 'localhost',
    proxy: {
      '/api': {
        target: renderApiUrl,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: Number(process.env['WEB_PORT'] ?? process.env['PORT'] ?? 4200),
    host: 'localhost',
    proxy: {
      '/api': {
        target: renderApiUrl,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
  },
  test: {
    globals: false,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/apps/web',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/main.tsx', 'src/test-setup.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
