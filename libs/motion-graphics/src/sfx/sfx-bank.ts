import { createSeededRandom, hashStringToSeed, pickAvoidingRecent } from '@video-maker/timeline-core';
import { z } from 'zod';

import { MotionStudioError } from '../errors/motion-studio-error';
import { joinPath } from '../pipeline/join-path';
import { formatIssuePath } from '../storyboard/parse-motion-storyboard';

export const SFX_KINDS = ['whoosh', 'impact', 'shimmer', 'riser', 'typing', 'click'] as const;
export type SfxKind = (typeof SFX_KINDS)[number];

export const SFX_BANK_DIRECTORY = 'sfx-bank';
export const SFX_BANK_MANIFEST = 'sfx-bank.json';

const REDISTRIBUTABLE_LICENSE = /^(CC0|CC BY \d(\.\d)?|Public Domain Mark)$/u;

const Text = z.string().trim().min(1);

export const SfxEntrySchema = z.strictObject({
  id: z.string().regex(/^[a-z]+-\d+$/u),
  kind: z.enum(SFX_KINDS),
  file: Text,
  title: Text,
  author: Text,
  license: z.string().regex(REDISTRIBUTABLE_LICENSE, 'only CC0, CC BY or Public Domain Mark can ship in the repo'),
  sourceUrl: z.string().url(),
  durationMs: z.number().int().positive(),
  momentaryMaxLufs: z.number().nullable(),
  truePeakDbtp: z.number().max(-1),
});

export type SfxEntry = z.infer<typeof SfxEntrySchema>;

export const SfxBankSchema = z
  .strictObject({
    version: z.literal(1),
    referenceMomentaryLufs: z.number(),
    sfx: z.array(SfxEntrySchema).min(1),
  })
  .superRefine((bank, ctx) => {
    const ids = bank.sfx.map((entry) => entry.id);
    ids.forEach((id, index) => {
      if (ids.indexOf(id) !== index) ctx.addIssue({ code: 'custom', path: ['sfx', index, 'id'], message: `duplicated sfx id "${id}"` });
    });
  });

export type SfxBank = z.infer<typeof SfxBankSchema>;

export function parseSfxBank(raw: unknown): SfxBank {
  const result = SfxBankSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.slice(0, 6).map((issue) => `${formatIssuePath(issue.path) || 'sfx-bank'}: ${issue.message}`);
  throw new MotionStudioError('ASSET_MISSING', `${SFX_BANK_MANIFEST} is invalid:\n  ${lines.join('\n  ')}`);
}

export function sfxBankDirectory(assetsRoot: string): string {
  return joinPath(assetsRoot, SFX_BANK_DIRECTORY);
}

export function sfxFilePath(assetsRoot: string, entry: SfxEntry): string {
  return joinPath(sfxBankDirectory(assetsRoot), entry.file);
}

export function sfxOfKind(bank: SfxBank, kind: SfxKind): readonly SfxEntry[] {
  return bank.sfx.filter((entry) => entry.kind === kind);
}

export function pickSfxVariant(bank: SfxBank, kind: SfxKind, seedKey: string, recentIds: readonly string[] = []): SfxEntry {
  const [first, ...rest] = sfxOfKind(bank, kind);
  if (first === undefined) {
    throw new MotionStudioError('ASSET_MISSING', `the sfx bank has no "${kind}" effect`);
  }
  const next = createSeededRandom(hashStringToSeed(`sfx:${kind}:${seedKey}`));
  const ids = [first.id, ...rest.map((entry) => entry.id)] as const;
  const id = pickAvoidingRecent(ids, recentIds, next);
  return [first, ...rest].find((entry) => entry.id === id) ?? first;
}
