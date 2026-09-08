import { describe, expect, it } from 'vitest';

import { PathEscapesProjectError } from '../errors/path-escapes-project-error';
import { resolveMediaProject } from './media-project';
import {
  catalogPath,
  editDecisionListPath,
  extractedAudioPath,
  isInsideRaw,
  rawAssetMirror,
  timelinePath,
  toAbsolutePath,
  toProjectRelativePath,
  transcriptPath,
  whisperOutBase,
  workPath,
} from './project-paths';

const project = resolveMediaProject('/tmp/media/pitch-deck');

describe('toProjectRelativePath', () => {
  it('convierte una ruta absoluta dentro del proyecto a relativa POSIX', () => {
    expect(toProjectRelativePath(project, '/tmp/media/pitch-deck/raw/aroll/clip01.mp4')).toBe(
      'raw/aroll/clip01.mp4',
    );
  });

  it('lanza PathEscapesProjectError si la ruta sale de la raíz del proyecto', () => {
    expect(() =>
      toProjectRelativePath(project, '/tmp/media/other-project/raw/aroll/clip01.mp4'),
    ).toThrow(PathEscapesProjectError);
  });
});

describe('toAbsolutePath', () => {
  it('es la inversa de toProjectRelativePath', () => {
    const relativePath = toProjectRelativePath(
      project,
      '/tmp/media/pitch-deck/raw/aroll/clip01.mp4',
    );

    expect(toAbsolutePath(project, relativePath)).toBe(
      '/tmp/media/pitch-deck/raw/aroll/clip01.mp4',
    );
  });
});

describe('isInsideRaw', () => {
  it('es true para una ruta bajo raw/', () => {
    expect(isInsideRaw('raw/aroll/clip01.mp4')).toBe(true);
  });

  it('es false para una ruta bajo work/', () => {
    expect(isInsideRaw('work/catalog.json')).toBe(false);
  });
});

describe('rawAssetMirror', () => {
  it('quita el prefijo raw/ y la extensión preservando la subcarpeta', () => {
    expect(rawAssetMirror('raw/aroll/clip01.mp4')).toBe('aroll/clip01');
  });

  it('preserva el anidamiento profundo', () => {
    expect(rawAssetMirror('raw/broll/city/skyline.mov')).toBe('broll/city/skyline');
  });

  it('deja la ruta intacta cuando el archivo no tiene extensión', () => {
    expect(rawAssetMirror('raw/aroll/clip-without-extension')).toBe('aroll/clip-without-extension');
  });
});

describe('workPath', () => {
  it('solo puede producir rutas bajo work/', () => {
    expect(workPath('transcripts', 'aroll', 'clip01.json')).toBe(
      'work/transcripts/aroll/clip01.json',
    );
  });
});

describe('rutas canónicas de work/', () => {
  it('catalogPath', () => {
    expect(catalogPath()).toBe('work/catalog.json');
  });

  it('transcriptPath preserva el mirror', () => {
    expect(transcriptPath('aroll/clip01')).toBe('work/transcripts/aroll/clip01.json');
  });

  it('extractedAudioPath preserva el mirror', () => {
    expect(extractedAudioPath('aroll/clip01')).toBe('work/audio/aroll/clip01.wav');
  });

  it('whisperOutBase preserva el mirror sin extensión', () => {
    expect(whisperOutBase('aroll/clip01')).toBe('work/whisper/aroll/clip01');
  });

  it('editDecisionListPath', () => {
    expect(editDecisionListPath()).toBe('work/edl.json');
  });

  it('timelinePath', () => {
    expect(timelinePath()).toBe('work/timeline.json');
  });
});
