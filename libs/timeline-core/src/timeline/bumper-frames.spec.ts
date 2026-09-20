import { describe, expect, it } from 'vitest';

import { ca013Assets } from '../__fixtures__/assets';
import { ca013Edl } from '../__fixtures__/edl';
import type { LogoBumper, Timeline } from '../schemas/timeline.schema';
import { LogoBumperSchema } from '../schemas/timeline.schema';
import { buildTimeline } from './build-timeline';
import {
  introBumperFrames,
  logoBumperFrames,
  outroBumperFrames,
  timelineTotalFrames,
} from './bumper-frames';
import { timelineWarnings } from './validate-timeline';

function referenceTimeline(): Timeline {
  return buildTimeline(ca013Edl, ca013Assets);
}

function bumper(patch: Partial<LogoBumper> = {}): LogoBumper {
  return LogoBumperSchema.parse({ enabled: true, ...patch });
}

function withBumpers(timeline: Timeline, bumpers: Timeline['bumpers']): Timeline {
  return { ...timeline, bumpers };
}

describe('LogoBumperSchema', () => {
  it('completa los defaults del bumper a partir de un objeto vacío', () => {
    expect(LogoBumperSchema.parse({})).toEqual({
      enabled: false,
      durationMs: 2000,
      backgroundColor: '#ffffff',
      animation: 'zoom',
      logoWidthRatio: 0.4,
    });
  });

  it.each([499, 6001, 2000.5])('rechaza durationMs fuera de rango o no entero (%s)', (durationMs) => {
    expect(LogoBumperSchema.safeParse({ enabled: true, durationMs }).success).toBe(false);
  });

  it.each([500, 6000])('acepta los extremos del rango de durationMs (%s)', (durationMs) => {
    expect(LogoBumperSchema.parse({ enabled: true, durationMs }).durationMs).toBe(durationMs);
  });

  it.each(['#fff', 'ffffff', '#ggggff', 'white', '#ffffff00'])(
    'rechaza un backgroundColor que no es hex #rrggbb (%s)',
    (backgroundColor) => {
      expect(LogoBumperSchema.safeParse({ backgroundColor }).success).toBe(false);
    },
  );

  it('acepta un hex #rrggbb en mayúsculas o minúsculas', () => {
    expect(LogoBumperSchema.parse({ backgroundColor: '#0B1020' }).backgroundColor).toBe('#0B1020');
  });

  it.each([0, 1.2, -0.4])('rechaza un logoWidthRatio fuera de (0, 1] (%s)', (logoWidthRatio) => {
    expect(LogoBumperSchema.safeParse({ logoWidthRatio }).success).toBe(false);
  });

  it('rechaza una animación desconocida', () => {
    expect(LogoBumperSchema.safeParse({ animation: 'spin' }).success).toBe(false);
  });
});

describe('timelineTotalFrames', () => {
  it('sin bumpers el total es el contenido', () => {
    const timeline = referenceTimeline();

    expect(timelineTotalFrames(timeline)).toBe(timeline.durationFrames);
    expect(introBumperFrames(timeline)).toBe(0);
    expect(outroBumperFrames(timeline)).toBe(0);
  });

  it('suma intro y outro en frames redondeados al fps de la Timeline', () => {
    const timeline = withBumpers(referenceTimeline(), {
      intro: bumper({ durationMs: 2000 }),
      outro: bumper({ durationMs: 2000 }),
    });

    expect(introBumperFrames(timeline)).toBe(60);
    expect(outroBumperFrames(timeline)).toBe(60);
    expect(timelineTotalFrames(timeline)).toBe(timeline.durationFrames + 120);
  });

  it('un bumper con enabled false no suma frames aunque tenga duración', () => {
    const timeline = withBumpers(referenceTimeline(), {
      intro: bumper({ enabled: false, durationMs: 4000 }),
    });

    expect(timelineTotalFrames(timeline)).toBe(timeline.durationFrames);
  });

  it('redondea la duración al frame más cercano', () => {
    expect(logoBumperFrames(bumper({ durationMs: 1500 }), 30)).toBe(45);
    expect(logoBumperFrames(bumper({ durationMs: 1516 }), 30)).toBe(45);
    expect(logoBumperFrames(bumper({ durationMs: 1550 }), 30)).toBe(47);
  });

  it('durationFrames sigue siendo el contenido: no lo toca nadie', () => {
    const content = referenceTimeline().durationFrames;
    const timeline = withBumpers(referenceTimeline(), { intro: bumper(), outro: bumper() });

    expect(timeline.durationFrames).toBe(content);
  });
});

describe('timelineWarnings', () => {
  it('avisa BUMPER_WITHOUT_LOGO por cada bumper activo cuando la Timeline no tiene logo', () => {
    const timeline = withBumpers(referenceTimeline(), { intro: bumper(), outro: bumper() });

    expect(timelineWarnings(timeline)).toEqual([
      { code: 'BUMPER_WITHOUT_LOGO', path: 'bumpers.intro', message: expect.any(String) },
      { code: 'BUMPER_WITHOUT_LOGO', path: 'bumpers.outro', message: expect.any(String) },
    ]);
  });

  it('no avisa por un bumper apagado', () => {
    const timeline = withBumpers(referenceTimeline(), { intro: bumper({ enabled: false }) });

    expect(timelineWarnings(timeline)).toEqual([]);
  });

  it('no avisa cuando la Timeline tiene logo', () => {
    const base = referenceTimeline();
    const logoAsset = base.assets[0];
    if (logoAsset === undefined) {
      throw new Error('la Timeline de referencia no tiene assets');
    }
    const timeline: Timeline = {
      ...withBumpers(base, { intro: bumper() }),
      logo: {
        assetId: logoAsset.id,
        position: 'bottom-right',
        widthRatio: 0.18,
        marginRatio: 0.035,
        opacity: 1,
      },
    };

    expect(timelineWarnings(timeline)).toEqual([]);
  });
});
