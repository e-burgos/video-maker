import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { VideoBackendProvider } from './video-backend';

vi.mock('remotion', async () => {
  const { createElement: create } = await import('react');
  const probe = (tag: string) => (props: Record<string, unknown>) =>
    create('div', {
      'data-component': tag,
      'data-src': String(props['src']),
      'data-trim-before': String(props['trimBefore']),
      'data-muted': String(props['muted'] === true),
    });

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

describe('TimelineVideo', () => {
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
});
