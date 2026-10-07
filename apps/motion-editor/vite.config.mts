/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import saveTimeline from './vite-plugins/save-timeline';
import reloadOnVideoChange from './vite-plugins/reload-on-video-change';

/**
 * motion-editor — generador de videos explicativos (1920x1080, timeline).
 *
 * No usa Tailwind a propósito: todo el estilado es inline (ver AGENTS.md,
 * contrato 3.4), porque el motor calcula cada frame a partir de un timestamp
 * y las clases/transiciones CSS romperían el seek determinista.
 */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/motion-editor',
  envDir: '../../',
  server: {
    port: 7315,
    host: 'localhost',
  },
  preview: {
    port: 7325,
    host: 'localhost',
  },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md']), saveTimeline(), reloadOnVideoChange()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: '../../dist/apps/motion-editor',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'motion-editor',
    watch: false,
    globals: true,
    environment: 'jsdom',
    passWithNoTests: false,
    include: ['{src,tests,vite-plugins}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/motion-editor',
      provider: 'v8' as const,
    },
  },
}));
