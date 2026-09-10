import type { StoryboardDocument } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import { leadingSceneNumber, mapNumberedSceneFiles } from './map-numbered-scene-files';

function storyboardWithScenes(count: number): StoryboardDocument {
  return {
    schemaVersion: 1,
    id: 'storyboard-01',
    source: 'brief',
    createdAt: '2026-09-10T12:00:00.000Z',
    title: 'Demo',
    language: 'es-AR',
    format: '9:16',
    captionsStyle: 'kinetic-bold',
    musicTags: [],
    characters: [],
    scenes: Array.from({ length: count }, (_, position) => ({
      id: `scene-${String(position + 1).padStart(2, '0')}`,
      index: position + 1,
      narration: `Narración ${position + 1}`,
      visualPrompt: `Prompt ${position + 1}`,
      visualSource: 'upload' as const,
      estimatedDurationMs: 3000,
      musicTags: [],
      sfxTags: [],
    })),
  };
}

describe('leadingSceneNumber', () => {
  it('lee el número de un archivo con cero a la izquierda', () => {
    expect(leadingSceneNumber('raw/broll/01.mp4')).toBe(1);
    expect(leadingSceneNumber('raw/images/02-cocina.png')).toBe(2);
  });

  it('lee el número del prefijo scene- que exporta la hoja de prompts', () => {
    expect(leadingSceneNumber('raw/broll/scene-03.mov')).toBe(3);
    expect(leadingSceneNumber('raw/broll/scene_04.mov')).toBe(4);
    expect(leadingSceneNumber('raw/broll/Scene05.mov')).toBe(5);
  });

  it('no confunde un número que arranca dentro de una palabra', () => {
    expect(leadingSceneNumber('raw/broll/toma01.mp4')).toBeNull();
    expect(leadingSceneNumber('raw/broll/final.mp4')).toBeNull();
  });

  it('rechaza el cero, que no es índice de ninguna escena', () => {
    expect(leadingSceneNumber('raw/broll/00.mp4')).toBeNull();
  });

  it('mira sólo el nombre del archivo, no los directorios que lo contienen', () => {
    expect(leadingSceneNumber('raw/01-tomas/final.mp4')).toBeNull();
  });
});

describe('mapNumberedSceneFiles', () => {
  const storyboard = storyboardWithScenes(3);

  it('asigna cada archivo numerado a la escena de ese índice', () => {
    const mapping = mapNumberedSceneFiles(storyboard, [
      'raw/broll/01.mp4',
      'raw/images/02-cocina.png',
      'raw/broll/scene-03.mov',
    ]);

    expect(mapping.matches).toEqual([
      { sceneId: 'scene-01', sceneIndex: 1, assetId: 'raw/broll/01.mp4' },
      { sceneId: 'scene-02', sceneIndex: 2, assetId: 'raw/images/02-cocina.png' },
      { sceneId: 'scene-03', sceneIndex: 3, assetId: 'raw/broll/scene-03.mov' },
    ]);
    expect(mapping.skipped).toEqual([]);
  });

  it('reporta el archivo sin número en vez de asignarlo a la escena que sobra', () => {
    const mapping = mapNumberedSceneFiles(storyboard, ['raw/broll/final.mp4']);

    expect(mapping.matches).toEqual([]);
    expect(mapping.skipped).toEqual([{ assetId: 'raw/broll/final.mp4', reason: 'no-leading-number' }]);
  });

  it('reporta el archivo cuyo número no corresponde a ninguna escena', () => {
    const mapping = mapNumberedSceneFiles(storyboard, ['raw/broll/09.mp4']);

    expect(mapping.skipped).toEqual([{ assetId: 'raw/broll/09.mp4', reason: 'no-scene-for-number' }]);
  });

  it('se queda con el primero por orden y reporta el segundo cuando dos archivos piden la misma escena', () => {
    const mapping = mapNumberedSceneFiles(storyboard, ['raw/images/01-b.png', 'raw/broll/01-a.mp4']);

    expect(mapping.matches).toEqual([
      { sceneId: 'scene-01', sceneIndex: 1, assetId: 'raw/broll/01-a.mp4' },
    ]);
    expect(mapping.skipped).toEqual([{ assetId: 'raw/images/01-b.png', reason: 'scene-already-taken' }]);
  });

  it('es determinista: el orden de entrada no cambia el resultado', () => {
    const forward = mapNumberedSceneFiles(storyboard, ['raw/broll/01.mp4', 'raw/images/02.png']);
    const backward = mapNumberedSceneFiles(storyboard, ['raw/images/02.png', 'raw/broll/01.mp4']);

    expect(forward).toEqual(backward);
  });

  it('no asigna nada cuando no hay archivos', () => {
    expect(mapNumberedSceneFiles(storyboard, [])).toEqual({ matches: [], skipped: [] });
  });
});
