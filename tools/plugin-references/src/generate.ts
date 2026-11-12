import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildSchemaReferences } from './build-references';
import type { GeneratedFile } from './build-references';
import { buildCapabilitiesReference } from './capabilities';

const WORKSPACE_ROOT = join(__dirname, '..', '..', '..');

export async function buildAllReferences(): Promise<GeneratedFile[]> {
  return [...buildSchemaReferences(), await buildCapabilitiesReference(WORKSPACE_ROOT)];
}

async function main(): Promise<void> {
  const files = await buildAllReferences();
  files.forEach((file) => {
    const target = join(WORKSPACE_ROOT, file.relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.contents, 'utf8');
  });
  console.log(`Generados ${files.length} archivos de referencia en plugins/video-maker/skills/video-maker/references`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
