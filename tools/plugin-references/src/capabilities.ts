import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseSfxBank, SFX_BANK_DIRECTORY, SFX_BANK_MANIFEST } from '@video-maker/motion-graphics';

import { describeVideoMakerCapabilities } from '@video-maker/studio-capabilities';
import type { GeneratedFile } from './build-references';
import { REFERENCES_DIR, REGENERATE_COMMAND } from './build-references';

const CAPABILITIES_SOURCE = 'libs/studio-capabilities/src/describe-video-maker-capabilities.ts';
const SFX_BANK_MANIFEST_PATH = join('libs/motion-graphics/assets', SFX_BANK_DIRECTORY, SFX_BANK_MANIFEST);

async function readRepoSfxBank(workspaceRoot: string) {
  const raw = await readFile(join(workspaceRoot, SFX_BANK_MANIFEST_PATH), 'utf8');
  return parseSfxBank(JSON.parse(raw));
}

export function renderCapabilities(value: unknown): string {
  return [
    '# Capabilities reference',
    '',
    `Generated from ${CAPABILITIES_SOURCE} with the repo SFX bank — do not edit by hand; run \`${REGENERATE_COMMAND}\`.`,
    '',
    'Voices depend on each machine: call the `list_voices` tool (or `get_capabilities`) to get the live list.',
    '',
    `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``,
    '',
  ].join('\n');
}

export async function buildCapabilitiesReference(workspaceRoot: string): Promise<GeneratedFile> {
  const sfxBank = await readRepoSfxBank(workspaceRoot);
  const capabilities = describeVideoMakerCapabilities({ sfxBank, voices: [] });
  return { relativePath: `${REFERENCES_DIR}/capabilities.md`, contents: renderCapabilities(capabilities) };
}
