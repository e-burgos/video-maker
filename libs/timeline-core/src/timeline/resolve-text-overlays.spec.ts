import { describe, expect, it } from 'vitest';

import { ca013Assets } from '../__fixtures__/assets';
import { ca013Edl } from '../__fixtures__/edl';
import { TEXT_OVERLAY_VARIANTS, TimelineSchema } from '../schemas/timeline.schema';
import type { TextOverlay, Timeline } from '../schemas/timeline.schema';
import { buildTimeline } from './build-timeline';
import { resolveTextOverlayTheme, resolveTextOverlays } from './resolve-text-overlays';

function withOverlays(overlays: TextOverlay[], id = 'video-a'): Timeline {
  return { ...buildTimeline(ca013Edl, ca013Assets), id, textOverlays: overlays };
}

function lowerThirds(count: number): TextOverlay[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `lt-${index}`,
    kind: 'lower-third' as const,
    startMs: index * 1300,
    durationMs: 1200,
    text: `Paso ${index + 1}`,
  }));
}

describe('TimelineSchema con textOverlays', () => {
  it('acepta una timeline sin pista de textos y una con textos válidos', () => {
    expect(TimelineSchema.safeParse(buildTimeline(ca013Edl, ca013Assets)).success).toBe(true);
    expect(TimelineSchema.safeParse(withOverlays(lowerThirds(2))).success).toBe(true);
  });

  it('rechaza una variante que no es del tipo de texto', () => {
    const result = TimelineSchema.safeParse(
      withOverlays([{ id: 'a', kind: 'lower-third', startMs: 0, durationMs: 1500, text: 'Hola', variant: 'word-pop' }]),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('no es de lower-third');
  });

  it('rechaza dos textos que se pisan y un texto que pasa el final', () => {
    const overlapping = TimelineSchema.safeParse(
      withOverlays([
        { id: 'a', kind: 'lower-third', startMs: 0, durationMs: 2000, text: 'Uno' },
        { id: 'b', kind: 'kinetic-text', startMs: 1500, durationMs: 2000, text: 'Dos' },
      ]),
    );
    expect(overlapping.error?.issues.map((issue) => issue.message).join()).toContain('se pisa');

    const timeline = buildTimeline(ca013Edl, ca013Assets);
    const endMs = Math.round((timeline.durationFrames / timeline.format.fps) * 1000);
    const late = TimelineSchema.safeParse(
      withOverlays([{ id: 'a', kind: 'chapter-title', startMs: endMs - 1000, durationMs: 2000, text: 'Tarde' }]),
    );
    expect(late.error?.issues[0]?.message).toContain('termina en');
  });

  it('rechaza ids repetidos', () => {
    const result = TimelineSchema.safeParse(
      withOverlays([
        { id: 'a', kind: 'lower-third', startMs: 0, durationMs: 1200, text: 'Uno' },
        { id: 'a', kind: 'lower-third', startMs: 1300, durationMs: 1200, text: 'Dos' },
      ]),
    );
    expect(result.error?.issues[0]?.message).toContain('repetido');
  });
});

describe('resolveTextOverlays', () => {
  it('dos textos seguidos del mismo tipo nunca repiten la variante', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const resolved = resolveTextOverlays(withOverlays(lowerThirds(5), id));
      resolved.slice(1).forEach((overlay, index) => {
        expect(overlay.variant).not.toBe(resolved[index]?.variant);
      });
      resolved.forEach((overlay) => expect(TEXT_OVERLAY_VARIANTS['lower-third']).toContain(overlay.variant));
    }
  });

  it('el mismo video siempre igual y videos distintos rotan distinto', () => {
    const first = resolveTextOverlays(withOverlays(lowerThirds(4), 'v1')).map((overlay) => overlay.variant);
    expect(resolveTextOverlays(withOverlays(lowerThirds(4), 'v1')).map((overlay) => overlay.variant)).toEqual(first);
    const others = ['v2', 'v3', 'v4', 'v5', 'v6', 'v7'].map((id) =>
      resolveTextOverlays(withOverlays(lowerThirds(4), id)).map((overlay) => overlay.variant).join(),
    );
    expect(new Set([first.join(), ...others]).size).toBeGreaterThan(1);
  });

  it('respeta la variante y el lugar pedidos, y pone cada tipo en su margen por defecto', () => {
    const resolved = resolveTextOverlays(
      withOverlays([
        { id: 'k', kind: 'kinetic-text', startMs: 4000, durationMs: 1500, text: 'Rápido', subtitle: 'no va' },
        { id: 'c', kind: 'chapter-title', startMs: 0, durationMs: 1500, text: 'Ventas', eyebrow: '01' },
        { id: 'l', kind: 'lower-third', startMs: 2000, durationMs: 1500, text: 'Caja', variant: 'plate-wipe', placement: 'bottom-right' },
      ]),
    );
    expect(resolved.map((overlay) => overlay.id)).toEqual(['c', 'l', 'k']);
    expect(resolved[0]).toMatchObject({ placement: 'top-center', eyebrow: '01' });
    expect(resolved[1]).toMatchObject({ placement: 'bottom-right', variant: 'plate-wipe', eyebrow: null });
    expect(resolved[2]).toMatchObject({ placement: 'top-center', subtitle: null });
  });
});

describe('resolveTextOverlayTheme', () => {
  it('usa la tipografía y los colores de la marca cuando la timeline los trae', () => {
    const theme = resolveTextOverlayTheme({
      captionTheme: {
        fontFamily: 'Marca Sans',
        fontFiles: [{ path: 'fonts/marca.woff2' }],
        textColor: '#fafafa',
        accentColor: '#ff0066',
        boxColor: '#111111',
      },
    });
    expect(theme).toEqual({
      fontFamily: '"Marca Sans", Inter, "Helvetica Neue", Arial, sans-serif',
      textColor: '#fafafa',
      accentColor: '#ff0066',
      plateColor: '#111111',
    });
  });

  it('sin marca toma el acento del estilo de bumpers', () => {
    expect(resolveTextOverlayTheme({ bumpers: { style: { rotate: true, accentColor: '#00aa55' } } }).accentColor).toBe('#00aa55');
  });
});
