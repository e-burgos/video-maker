import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { CAPTION_PRESET_GALLERY_ID, CaptionPresetGallery } from './components/caption-preset-gallery';
import { TIMELINE_COMPOSITION_ID } from './components/timeline-composition';
import { RemotionRoot } from './Root';

type CompositionElement = ReactElement<{
  id: string;
  component: unknown;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  calculateMetadata?: unknown;
}>;

function registeredCompositions(): readonly CompositionElement[] {
  const tree = RemotionRoot({});

  if (!isValidElement(tree)) {
    throw new Error('expected RemotionRoot to return a fragment of compositions');
  }

  const fragmentProps = tree.props as { children?: ReactNode };
  return Children.toArray(fragmentProps.children).filter(
    isValidElement,
  ) as readonly CompositionElement[];
}

function compositionById(id: string): CompositionElement {
  const found = registeredCompositions().find((composition) => composition.props.id === id);

  if (!found) {
    throw new Error(`expected a registered Composition with id ${id}`);
  }

  return found;
}

describe('RemotionRoot', () => {
  it('registra la composición de galería de presets con el componente CaptionPresetGallery (CA-010)', () => {
    const gallery = compositionById(CAPTION_PRESET_GALLERY_ID);

    expect(gallery.props.component).toBe(CaptionPresetGallery);
  });

  it('la galería mide cuatro paneles de 1080x1920 lado a lado, sin calculateMetadata (CA-010)', () => {
    const gallery = compositionById(CAPTION_PRESET_GALLERY_ID);

    expect(gallery.props.width).toBe(4320);
    expect(gallery.props.height).toBe(1920);
    expect(gallery.props.fps).toBe(30);
    expect(gallery.props.durationInFrames).toBe(265);
    expect(gallery.props.calculateMetadata).toBeUndefined();
  });

  it('la galería se suma a las composiciones de Timeline preexistentes, sin reemplazarlas', () => {
    const ids = registeredCompositions().map((composition) => composition.props.id);

    expect(ids).toContain(TIMELINE_COMPOSITION_ID);
    expect(ids).toContain('TimelineCompositionLandscape');
    expect(ids).toContain(CAPTION_PRESET_GALLERY_ID);
  });
});
