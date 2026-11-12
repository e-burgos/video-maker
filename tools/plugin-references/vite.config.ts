import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const lib = (name: string, entry = 'src/index.ts'): string =>
  fileURLToPath(new URL(`../../libs/${name}/${entry}`, import.meta.url));

export default defineConfig({
  cacheDir: '../../node_modules/.vite/plugin-references',
  resolve: {
    alias: {
      '@video-maker/timeline-core': lib('timeline-core'),
      '@video-maker/motion-graphics': lib('motion-graphics'),
      '@video-maker/producer-tools': lib('producer-tools'),
      '@video-maker/auto-montage': lib('auto-montage'),
      '@video-maker/local-store': lib('local-store'),
      '@video-maker/media-local': lib('media-local'),
      '@video-maker/studio-capabilities': lib('studio-capabilities'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
