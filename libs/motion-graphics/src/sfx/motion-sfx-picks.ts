import type { MotionScript } from '../script/motion-script';
import type { MotionTimeline } from '../template/motion-timeline';
import { pickSfxVariant, SFX_BANK_DIRECTORY } from './sfx-bank';
import type { SfxBank, SfxEntry, SfxKind } from './sfx-bank';

export const PROJECT_SFX_DIR = `assets/${SFX_BANK_DIRECTORY}`;
export const RECENT_WHOOSHES_TO_AVOID = 2;
export const ACCENT_SFX = ['riser', 'impact'] as const satisfies readonly SfxKind[];
export type AccentSfx = (typeof ACCENT_SFX)[number];

export interface PickedSfx {
  readonly src: string;
  readonly durationSec: number;
  readonly entry: SfxEntry;
}

export interface MotionSfxPicks {
  readonly whooshByScene: ReadonlyMap<string, PickedSfx>;
  readonly accents: Partial<Readonly<Record<AccentSfx, PickedSfx>>>;
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
  return {
    whooshByScene,
    accents: {
      riser: picked(pickSfxVariant(bank, 'riser', seedKey)),
      impact: picked(pickSfxVariant(bank, 'impact', seedKey)),
    },
  };
}

export function sfxCreditLines(picks: MotionSfxPicks): string[] {
  const accents = Object.values(picks.accents).filter((pick): pick is PickedSfx => pick !== undefined);
  const entries = [...picks.whooshByScene.values(), ...accents].map((pick) => pick.entry);
  const unique = entries.filter((entry, index) => entries.findIndex((other) => other.id === entry.id) === index);
  return unique
    .filter((entry) => entry.license.startsWith('CC BY'))
    .map((entry) => `Efecto de sonido: «${entry.title}» de ${entry.author} (${entry.license}) — ${entry.sourceUrl}`);
}
