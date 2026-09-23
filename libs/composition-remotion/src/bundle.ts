import { resolve } from 'node:path';
import { bundle } from '@remotion/bundler';

import { DEFAULT_ENTRY_POINT, withWorkspaceAliases } from './render';

const DEFAULT_OUT_DIR = resolve(__dirname, '../../../dist/libs/composition-remotion/bundle');

async function main(): Promise<void> {
  const outDir = process.env['REMOTION_BUNDLE_OUT_DIR'] ?? DEFAULT_OUT_DIR;

  const serveUrl = await bundle({
    entryPoint: DEFAULT_ENTRY_POINT,
    webpackOverride: withWorkspaceAliases,
    publicDir: null,
    outDir,
  });

  console.log(serveUrl);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
