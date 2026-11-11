import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseSfxBank, SFX_BANK_MANIFEST, sfxBankDirectory } from '@video-maker/motion-graphics';
import type { SfxBank } from '@video-maker/motion-graphics';

export async function loadSfxBank(assetsRoot: string): Promise<SfxBank | null> {
  let raw: string;
  try {
    raw = await readFile(join(sfxBankDirectory(assetsRoot), SFX_BANK_MANIFEST), 'utf8');
  } catch {
    return null;
  }
  return parseSfxBank(JSON.parse(raw));
}
