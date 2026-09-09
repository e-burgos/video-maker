import { createElement } from 'react';
import type { FC } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIDEO_BACKEND,
  VideoBackendProvider,
  useVideoBackend,
} from './video-backend';

const BackendProbe: FC = () => createElement('span', null, useVideoBackend());

describe('video backend context', () => {
  it("declara 'render' como default para que el render no dependa de ningun proveedor", () => {
    expect(DEFAULT_VIDEO_BACKEND).toBe('render');
  });

  it("sin proveedor resuelve al backend de render", () => {
    expect(renderToStaticMarkup(createElement(BackendProbe))).toBe('<span>render</span>');
  });

  it("con proveedor resuelve al backend declarado", () => {
    const tree = createElement(
      VideoBackendProvider,
      { backend: 'player' as const },
      createElement(BackendProbe),
    );

    expect(renderToStaticMarkup(tree)).toBe('<span>player</span>');
  });
});
