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
    const sources = [...picks.whooshByScene.values(), ...Object.values(picks.accents)].map((pick) => pick?.src ?? '');

    expect(sources.every((src) => src.startsWith('assets/sfx-bank/'))).toBe(true);
  });

  it("es determinista por video y acredita solo los CC BY que aparecen en el html", () => {
    const a = pickMotionSfx(bank, timeline, script, 'video-a');

    expect([...pickMotionSfx(bank, timeline, script, 'video-a').whooshByScene.values()].map((p) => p.entry.id)).toEqual(
      [...a.whooshByScene.values()].map((p) => p.entry.id),
    );
    const html = [...a.whooshByScene.values(), ...Object.values(a.accents)].map((p) => `src="${p?.src}"`).join(' ');
    expect(sfxCreditLines(a, '')).toEqual([]);
    sfxCreditLines(a, html).forEach((line) => expect(line).toMatch(/^Efecto de sonido: «.+» de .+ \(CC BY [\d.]+\) — https?:\/\//u));
  });

  it('ofrece dos variantes distintas de cada tipo del banco para las plantillas a mano', () => {
    const picks = pickMotionSfx(bank, timeline, script, 'video-a');

    for (const kind of ['whoosh', 'impact', 'shimmer', 'riser', 'typing', 'click']) {
      expect(picks.accents[kind]?.entry.kind).toBe(kind);
      expect(picks.accents[`${kind}:2`]?.entry.id).not.toBe(picks.accents[kind]?.entry.id);
    }
  });
});
