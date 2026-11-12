import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const lib = (name: string, entry = 'src/index.ts'): string =>
  fileURLToPath(new URL(`../${name}/${entry}`, import.meta.url));

export default defineConfig({
  cacheDir: '../../node_modules/.vite/studio-capabilities',
  resolve: {
    alias: {
      '@video-maker/auto-montage': lib('auto-montage'),
      '@video-maker/local-store': lib('local-store'),
      '@video-maker/media-local': lib('media-local'),
      '@video-maker/motion-graphics': lib('motion-graphics'),
      '@video-maker/timeline-core': lib('timeline-core'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
