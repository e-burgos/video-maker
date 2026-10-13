import { describe, expect, it } from 'vitest';

import {
  PRODUCER_SCRIPT_PATH,
  VOICE_TRACK_PATH,
  formatFileSize,
  groupGeneratedFiles,
  hasGeneratedOutput,
} from './generated-files';
import type { GeneratedListing } from './render-api-types';

function listing(paths: readonly string[]): GeneratedListing {
  return {
    slug: 'display-ads',
    roots: ['work/voice', 'work/producer', 'out'],
    files: paths.map((path) => ({ path, sizeBytes: 2_500_000, modifiedAtMs: 1, sample: path.endsWith('.sample.mp4') })),
  };
}

describe('groupGeneratedFiles (FIX-006-001)', () => {
  it('separa la narración, el guion y los entregables', () => {
    const group = groupGeneratedFiles(
      listing([
        VOICE_TRACK_PATH,
        'work/voice/voice.words.json',
        PRODUCER_SCRIPT_PATH,
        'out/display-ads.mp4',
        'out/display-ads-9x16.mp4',
      ]),
    );

    expect(group.narration?.path).toBe(VOICE_TRACK_PATH);
    expect(group.script?.path).toBe(PRODUCER_SCRIPT_PATH);
    expect(group.deliverables.map((file) => file.path)).toEqual([
      'out/display-ads.mp4',
      'out/display-ads-9x16.mp4',
    ]);
  });

  it('ignora de out/ lo que no es un mp4', () => {
    const group = groupGeneratedFiles(listing(['out/render.log', 'out/thumb.png']));

    expect(group.deliverables).toEqual([]);
    expect(hasGeneratedOutput(group)).toBe(false);
  });

  it('sin listado devuelve el grupo vacío', () => {
    const group = groupGeneratedFiles(null);

    expect(group).toEqual({ narration: null, script: null, deliverables: [] });
    expect(hasGeneratedOutput(group)).toBe(false);
  });

  it('un solo archivo alcanza para que haya salida', () => {
    expect(hasGeneratedOutput(groupGeneratedFiles(listing([PRODUCER_SCRIPT_PATH])))).toBe(true);
  });
});

describe('formatFileSize', () => {
  it('usa MB a partir del millón de bytes', () => {
    expect(formatFileSize(2_500_000)).toBe('2.5 MB');
  });

  it('usa kB por debajo del millón', () => {
    expect(formatFileSize(48_000)).toBe('48 kB');
  });

  it('nunca informa 0 kB para un archivo con contenido', () => {
    expect(formatFileSize(120)).toBe('1 kB');
  });
});
