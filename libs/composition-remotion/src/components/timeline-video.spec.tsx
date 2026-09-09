import type { CSSProperties } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoBackendProvider } from './video-backend';

const capturedStyles: { OffthreadVideo: unknown[]; Video: unknown[] } = {
  OffthreadVideo: [],
  Video: [],
};

vi.mock('remotion', async () => {
  const { createElement: create } = await import('react');
  const probe = (tag: 'OffthreadVideo' | 'Video') => (props: Record<string, unknown>) => {
    capturedStyles[tag].push(props['style']);
    return create('div', {
      'data-component': tag,
      'data-src': String(props['src']),
      'data-trim-before': String(props['trimBefore']),
      'data-muted': String(props['muted'] === true),
    });
  };

  return { OffthreadVideo: probe('OffthreadVideo'), Video: probe('Video') };
});

const { TimelineVideo } = await import('./timeline-video');

const PROPS = { src: 'https://studio.local/api/clip.mp4', trimBefore: 12, style: {} };

function markupFor(backend: 'render' | 'player' | null): string {
  const video = createElement(TimelineVideo, PROPS);

  return renderToStaticMarkup(
    backend === null ? video : createElement(VideoBackendProvider, { backend }, video),
  );
}

function renderWithStyle(backend: 'render' | 'player', style: CSSProperties): void {
  const video = createElement(TimelineVideo, { ...PROPS, style });

  renderToStaticMarkup(createElement(VideoBackendProvider, { backend }, video));
}

describe('TimelineVideo', () => {
  beforeEach(() => {
    capturedStyles.OffthreadVideo = [];
    capturedStyles.Video = [];
  });


  it('sin proveedor monta OffthreadVideo: el arbol del render no cambia', () => {
    expect(markupFor(null)).toContain('data-component="OffthreadVideo"');
  });

  it("con backend 'render' monta OffthreadVideo", () => {
    expect(markupFor('render')).toContain('data-component="OffthreadVideo"');
  });

  it("con backend 'player' monta Video, el componente que el Player del navegador soporta", () => {
    const markup = markupFor('player');

    expect(markup).toContain('data-component="Video"');
    expect(markup).not.toContain('OffthreadVideo');
  });

  it('pasa los mismos props a los dos backends: src, trimBefore y muted', () => {
    for (const backend of ['render', 'player'] as const) {
      const markup = markupFor(backend);

      expect(markup).toContain('data-src="https://studio.local/api/clip.mp4"');
      expect(markup).toContain('data-trim-before="12"');
      expect(markup).toContain('data-muted="true"');
    }
  });

  it('D-12: la rama player aplica objectFit "fill" como default cuando el llamador no lo declara (H-2)', () => {
    renderWithStyle('player', {});

    expect(capturedStyles.Video).toEqual([{ objectFit: 'fill' }]);
  });

  it('D-12: el objectFit del llamador gana sobre el default de la rama player (caso b-roll cover/contain)', () => {
    renderWithStyle('player', { objectFit: 'cover' });
    renderWithStyle('player', { objectFit: 'contain' });

    expect(capturedStyles.Video).toEqual([{ objectFit: 'cover' }, { objectFit: 'contain' }]);
  });

  it('D-12: el resto de las propiedades del estilo del llamador conviven con el default de la rama player', () => {
    renderWithStyle('player', { transform: 'scale(1.15)', transformOrigin: '50% 33%' });

    expect(capturedStyles.Video).toEqual([
      { objectFit: 'fill', transform: 'scale(1.15)', transformOrigin: '50% 33%' },
    ]);
  });

  it('D-12: la rama render recibe el style tal cual entra, sin ninguna clave agregada (el arbol de render no cambia)', () => {
    const callerStyle: CSSProperties = { transform: 'scale(1.15)', transformOrigin: '50% 33%' };

    renderWithStyle('render', callerStyle);

    expect(capturedStyles.OffthreadVideo).toHaveLength(1);
    const received = capturedStyles.OffthreadVideo[0];
    expect(Object.keys(received as object).sort()).toEqual(Object.keys(callerStyle).sort());
    expect(received).toEqual(callerStyle);
  });
});
