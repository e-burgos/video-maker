import { describe, expect, it } from 'vitest';

import { TimelineBumpersSchema } from '../schemas/timeline.schema';
import type { Timeline, TimelineBumpers } from '../schemas/timeline.schema';
import { planBumperSfx } from './plan-bumper-sfx';
import { resolveBumperLook } from './resolve-bumper-look';

function timelineWith(bumpers: unknown): Timeline {
  return {
    id: 'timeline-test',
    format: { preset: 'youtube-16x9', width: 1920, height: 1080, fps: 30 },
    durationFrames: 300,
    bumpers: TimelineBumpersSchema.parse(bumpers),
  } as unknown as Timeline;
}

const ON = { enabled: true };

describe('planBumperSfx', () => {
  it('sin rotación ni efecto elegido los bumpers viejos siguen en silencio', () => {
    expect(planBumperSfx(timelineWith({ intro: ON, outro: ON }))).toEqual([]);
  });

  it('con rotación cada bumper suena según su revelado y el outro cae después del contenido', () => {
    const plan = planBumperSfx(
      timelineWith({ intro: { ...ON, reveal: 'wipe' }, outro: { ...ON, reveal: 'pop' }, style: { rotate: true } }),
    );

    expect(plan).toEqual([
      { source: 'auto', edge: 'intro', kind: 'whoosh', atMs: 0, gainDb: -14, fadeOutMs: 200 },
      { source: 'auto', edge: 'outro', kind: 'impact', atMs: 2000 + 10_000 + 330, gainDb: -12, fadeOutMs: 250 },
    ]);
  });

  it('el outro no repite el efecto del intro aunque su revelado pida el mismo', () => {
    const bumpers: TimelineBumpers = TimelineBumpersSchema.parse({
      intro: { ...ON, reveal: 'wipe' },
      outro: { ...ON, reveal: 'slide-up' },
      style: { rotate: true },
    });

    expect(resolveBumperLook(bumpers, 'intro', 'x')?.sfxKind).toBe('whoosh');
    expect(resolveBumperLook(bumpers, 'outro', 'x')?.sfxKind).toBe('impact');
  });

  it('el resplandor pide brillo y la elección a mano gana, incluso para silenciar', () => {
    const glow = TimelineBumpersSchema.parse({ intro: { ...ON, reveal: 'zoom', background: 'glow' }, style: { rotate: true } });
    const manual = TimelineBumpersSchema.parse({ intro: { ...ON, reveal: 'zoom', sfxKind: 'whoosh' } });
    const muted = TimelineBumpersSchema.parse({ intro: { ...ON, reveal: 'zoom', sfxKind: 'none' }, style: { rotate: true } });

    expect(resolveBumperLook(glow, 'intro', 'x')?.sfxKind).toBe('shimmer');
    expect(resolveBumperLook(manual, 'intro', 'x')?.sfxKind).toBe('whoosh');
    expect(planBumperSfx(timelineWith(muted))).toEqual([]);
  });

  it('el remate tipeado suma pocos clicks suaves, como máximo tres', () => {
    const plan = planBumperSfx(
      timelineWith({ outro: { ...ON, reveal: 'wipe', caption: 'displayads.com.ar' }, style: { rotate: true } }),
    );
    const clicks = plan.filter((cue) => cue.source === 'auto' && cue.kind === 'click');

    expect(clicks).toHaveLength(3);
    expect(clicks.every((cue) => cue.gainDb === -24)).toBe(true);
    expect(clicks[0]?.atMs).toBe(10_000 + 600);
  });

  it('los cues explícitos con asset ganan y se corren al tiempo absoluto del video', () => {
    const plan = planBumperSfx(
      timelineWith({
        intro: ON,
        outro: { ...ON, sfx: [{ atMs: 100, assetId: 'sfx/hit.mp3', gainDb: -10, fadeOutMs: 300 }] },
        style: { rotate: true },
      }),
    );

    expect(plan.filter((cue) => cue.edge === 'outro')).toEqual([
      { source: 'cue', edge: 'outro', atMs: 2000 + 10_000 + 100, assetId: 'sfx/hit.mp3', gainDb: -10, fadeOutMs: 300 },
    ]);
  });

  it('un bumper apagado no suena', () => {
    expect(planBumperSfx(timelineWith({ intro: { enabled: false }, style: { rotate: true } }))).toEqual([]);
  });
});
