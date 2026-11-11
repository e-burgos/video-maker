import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { MotionScript } from '../script/motion-script';
import type { MotionTimeline } from '../template/motion-timeline';
import { pickMotionSfx, sfxCreditLines } from './motion-sfx-picks';
import { parseSfxBank } from './sfx-bank';

const bank = parseSfxBank(JSON.parse(readFileSync(join(__dirname, '../../assets/sfx-bank/sfx-bank.json'), 'utf8')));
const ids = Array.from({ length: 10 }, (_, i) => `s${i}`);
const timeline = { scenes: ids.map((id, i) => ({ id, start: i * 5, end: i * 5 + 5, voStart: i * 5, voDuration: 2 })) } as unknown as MotionTimeline;
const script = { noWhooshOn: [], sfx: [] } as unknown as MotionScript;

describe('pickMotionSfx', () => {
  it('rota el whoosh de cada corte sin repetir ninguno de los dos anteriores', () => {
    const sequence = [...pickMotionSfx(bank, timeline, script, 'video-a').whooshByScene.values()].map((pick) => pick.entry.id);

    expect(sequence).toHaveLength(9);
    sequence.slice(2).forEach((id, i) => expect([sequence[i], sequence[i + 1]]).not.toContain(id));
    expect(sequence.every((id) => id.startsWith('whoosh-'))).toBe(true);
  });

  it('usa solo archivos del banco nuevo, nunca los de runtime/sfx', () => {
    const picks = pickMotionSfx(bank, timeline, script, 'video-a');
    const sources = [...picks.whooshByScene.values(), picks.accents.riser, picks.accents.impact].map((pick) => pick.src);

    expect(sources.every((src) => src.startsWith('assets/sfx-bank/'))).toBe(true);
  });

  it('es determinista por video y acredita solo los CC BY usados', () => {
    const a = pickMotionSfx(bank, timeline, script, 'video-a');

    expect([...pickMotionSfx(bank, timeline, script, 'video-a').whooshByScene.values()].map((p) => p.entry.id)).toEqual(
      [...a.whooshByScene.values()].map((p) => p.entry.id),
    );
    sfxCreditLines(a).forEach((line) => expect(line).toMatch(/^Efecto de sonido: «.+» de .+ \(CC BY [\d.]+\) — https?:\/\//u));
  });
});
