import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = join(repoRoot, 'dist/libs/producer-tools/mcp/main.js');
const templateDir = join(repoRoot, 'libs/producer-tools/npm');
const outputDir = join(repoRoot, 'dist/packages/video-maker-mcp');
const binPath = join(outputDir, 'bin/video-maker-mcp.js');
const SHEBANG = '#!/usr/bin/env node\n';
const SOURCE_MAP_COMMENT = /^\/\/# sourceMappingURL=.*$/gmu;

const bundle = (await readFile(bundlePath, 'utf8')).replace(SOURCE_MAP_COMMENT, '');

await rm(outputDir, { recursive: true, force: true });
await mkdir(dirname(binPath), { recursive: true });
await writeFile(binPath, SHEBANG + bundle);
await chmod(binPath, 0o755);
for (const file of ['package.json', 'README.md', 'LICENSE']) {
  await copyFile(join(templateDir, file), join(outputDir, file));
}

process.stdout.write(`video-maker-mcp package ready in ${outputDir}\n`);
