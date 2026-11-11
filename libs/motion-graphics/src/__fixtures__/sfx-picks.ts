import type { SfxEntry } from '../sfx/sfx-bank';
import type { MotionSfxPicks, PickedSfx } from '../sfx/motion-sfx-picks';

function entry(id: string, kind: SfxEntry['kind'], durationMs: number, license = 'CC0'): SfxEntry {
  return {
    id,
    kind,
    file: `${id}.mp3`,
    title: `Title ${id}`,
    author: 'Autor',
    license,
    sourceUrl: `https://example.test/${id}`,
    durationMs,
    momentaryMaxLufs: -20,
    truePeakDbtp: -2,
  };
}

function picked(sfx: SfxEntry): PickedSfx {
  return { src: `assets/sfx-bank/${sfx.file}`, durationSec: sfx.durationMs / 1000, entry: sfx };
}

export function testSfxPicks(whooshSceneIds: readonly string[] = ['end']): MotionSfxPicks {
  return {
    whooshByScene: new Map(whooshSceneIds.map((id, index) => [id, picked(entry(`whoosh-${(index % 3) + 1}`, 'whoosh', 600))])),
    accents: { riser: picked(entry('riser-1', 'riser', 3400)), impact: picked(entry('impact-2', 'impact', 2500, 'CC BY 4.0')) },
  };
}
