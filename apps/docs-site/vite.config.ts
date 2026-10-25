import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: '../../node_modules/.vite/docs-site',
  test: {
    globals: false,
    environment: 'node',
    include: ['functions/**/*.spec.mjs', 'scripts/**/*.spec.mjs', 'src/**/*.spec.mjs'],
  },
});
