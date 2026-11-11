import type { MotionScript } from '../script/motion-script';
import type { MotionTimeline } from '../template/motion-timeline';
import { pickSfxVariant, SFX_BANK_DIRECTORY, SFX_KINDS } from './sfx-bank';
import type { SfxBank, SfxEntry, SfxKind } from './sfx-bank';

export const PROJECT_SFX_DIR = `assets/${SFX_BANK_DIRECTORY}`;
export const RECENT_WHOOSHES_TO_AVOID = 2;
export const ACCENT_VARIANTS_PER_KIND = 2;

export interface PickedSfx {
  readonly src: string;
  readonly durationSec: number;
  readonly entry: SfxEntry;
}

export interface MotionSfxPicks {
  readonly whooshByScene: ReadonlyMap<string, PickedSfx>;
  readonly accents: Readonly<Record<string, PickedSfx | undefined>>;
}

export const NO_SFX_PICKS: MotionSfxPicks = { whooshByScene: new Map(), accents: {} };

function picked(entry: SfxEntry): PickedSfx {
  return { src: `${PROJECT_SFX_DIR}/${entry.file}`, durationSec: entry.durationMs / 1000, entry };
}

export function whooshSceneIds(timeline: MotionTimeline, script: MotionScript): string[] {
  return timeline.scenes
    .slice(1)
    .filter((scene) => !script.noWhooshOn.includes(scene.id))
    .map((scene) => scene.id);
}

export function pickMotionSfx(bank: SfxBank, timeline: MotionTimeline, script: MotionScript, seedKey: string): MotionSfxPicks {
  const used: string[] = [];
  const whooshByScene = new Map<string, PickedSfx>();
  whooshSceneIds(timeline, script).forEach((sceneId) => {
    const entry = pickSfxVariant(bank, 'whoosh', `${seedKey}:${sceneId}`, used.slice(-RECENT_WHOOSHES_TO_AVOID));
    used.push(entry.id);
    whooshByScene.set(sceneId, picked(entry));
  });
  return { whooshByScene, accents: accentPicks(bank, seedKey) };
}

export function accentKey(kind: SfxKind, variant: number): string {
  return variant === 1 ? kind : `${kind}:${variant}`;
}

function accentPicks(bank: SfxBank, seedKey: string): Record<string, PickedSfx> {
  const accents: Record<string, PickedSfx> = {};
  SFX_KINDS.filter((kind) => bank.sfx.some((entry) => entry.kind === kind)).forEach((kind) => {
    const used: string[] = [];
    for (let variant = 1; variant <= ACCENT_VARIANTS_PER_KIND; variant += 1) {
      const entry = pickSfxVariant(bank, kind, seedKey, used);
      used.push(entry.id);
      accents[accentKey(kind, variant)] = picked(entry);
    }
  });
  return accents;
}

export function sfxCreditLines(picks: MotionSfxPicks, composedHtml: string): string[] {
  const accents = Object.values(picks.accents).filter((pick): pick is PickedSfx => pick !== undefined);
  const entries = [...picks.whooshByScene.values(), ...accents]
    .filter((pick) => composedHtml.includes(`src="${pick.src}"`))
    .map((pick) => pick.entry);
  const unique = entries.filter((entry, index) => entries.findIndex((other) => other.id === entry.id) === index);
  return unique
    .filter((entry) => entry.license.startsWith('CC BY'))
    .map((entry) => `Efecto de sonido: «${entry.title}» de ${entry.author} (${entry.license}) — ${entry.sourceUrl}`);
}
