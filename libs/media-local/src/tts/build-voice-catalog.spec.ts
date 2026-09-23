import { describe, expect, it } from 'vitest';

import {
  buildVoiceCatalog,
  DEFAULT_VOICE_ID,
  voiceDirectoryName,
  voiceIdFromDirectoryName,
  voiceModelConfigFileName,
  voiceModelId,
} from './build-voice-catalog';

function voiceFile(directory: string, fileName: string, config: unknown = null) {
  return { directory, fileName, config };
}

const DANIELA_CONFIG = {
  dataset: 'daniela',
  audio: { sample_rate: 22050, quality: 'high' },
  language: {
    code: 'es_AR',
    family: 'es',
    region: 'AR',
    name_native: 'Español',
    name_english: 'Spanish',
    country_english: 'Argentina',
  },
};

describe('buildVoiceCatalog (US-09-003, US-016-001, US-017-201)', () => {
  it('lista las voces ordenadas por id y marca la default con DEFAULT_VOICE_ID', () => {
    const catalog = buildVoiceCatalog([
      voiceFile('vits-piper-es_ES-sharvard-medium', 'es_ES-sharvard-medium.onnx'),
      voiceFile('vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx'),
      voiceFile('vits-piper-en_US-lessac-high', 'en_US-lessac-high.onnx'),
    ]);

    expect(catalog.map((voice) => voice.id)).toEqual([
      'en_US-lessac-high',
      'es_AR-daniela-high',
      'es_ES-sharvard-medium',
    ]);
    expect(catalog.filter((voice) => voice.isDefault).map((voice) => voice.id)).toEqual([
      'es_AR-daniela-high',
    ]);
  });

  it('publica el directorio de la voz junto a su descripción', () => {
    const [voice] = buildVoiceCatalog([
      voiceFile('vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx', DANIELA_CONFIG),
    ]);

    expect(voice).toEqual({
      id: 'es_AR-daniela-high',
      directory: 'vits-piper-es_AR-daniela-high',
      fileName: 'es_AR-daniela-high.onnx',
      isDefault: true,
      language: { code: 'es-AR', region: 'AR' },
      quality: 'high',
      label: 'Daniela · Spanish (Argentina) · High quality',
      description:
        'Neural voice trained on the "daniela" dataset. Spanish as spoken in Argentina, synthesized at 22050 Hz.',
    });
  });

  it('sin sidecar de metadatos cae al nombre del archivo y lo dice en la descripcion', () => {
    const [voice] = buildVoiceCatalog([
      voiceFile('vits-piper-en_US-lessac-high', 'en_US-lessac-high.onnx'),
    ]);

    expect(voice?.language).toEqual({ code: 'en-US', region: 'US' });
    expect(voice?.quality).toBe('high');
    expect(voice?.label).toBe('Lessac · en-US · High quality');
    expect(voice?.description).toBe(
      'Derived from the model file name: this voice has no .onnx.json metadata next to it.',
    );
  });

  it('un sidecar corrupto se trata como ausente en vez de romper el catalogo', () => {
    const [voice] = buildVoiceCatalog([
      voiceFile('vits-piper-es_MX-claude-high', 'es_MX-claude-high.onnx', 'not an object'),
    ]);

    expect(voice?.label).toBe('Claude · es-MX · High quality');
    expect(voice?.quality).toBe('high');
  });

  it('un nombre sin calidad reconocible publica quality null en vez de inventar una', () => {
    const [voice] = buildVoiceCatalog([voiceFile('vits-piper-custom', 'custom.onnx')]);

    expect(voice?.quality).toBeNull();
    expect(voice?.label).toBe('Custom · custom');
  });

  it('los metadatos del sidecar ganan sobre lo que dice el nombre del archivo', () => {
    const [voice] = buildVoiceCatalog([
      voiceFile('vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx', {
        ...DANIELA_CONFIG,
        audio: { sample_rate: 22050, quality: 'medium' },
      }),
    ]);

    expect(voice?.quality).toBe('medium');
  });

  it('descarta cualquier archivo que no sea el .onnx del directorio', () => {
    const catalog = buildVoiceCatalog([
      voiceFile('vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx'),
      voiceFile('vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx.json'),
      voiceFile('vits-piper-es_AR-daniela-high', 'README.md'),
      voiceFile('vits-piper-es_AR-daniela-high', '.onnx'),
    ]);

    expect(catalog.map((voice) => voice.fileName)).toEqual(['es_AR-daniela-high.onnx']);
  });

  it('sin ningun .onnx presente devuelve una lista vacia', () => {
    expect(buildVoiceCatalog([voiceFile('vits-piper-es_AR-daniela-high', 'README.md')])).toEqual(
      [],
    );
  });

  it('ninguna voz es default cuando se pasa un id que no esta en el directorio', () => {
    const catalog = buildVoiceCatalog(
      [voiceFile('vits-piper-en_US-lessac-high', 'en_US-lessac-high.onnx')],
      'es_AR-daniela-high',
    );

    expect(catalog.every((voice) => !voice.isDefault)).toBe(true);
  });

  it('sin id default explicito usa DEFAULT_VOICE_ID', () => {
    const catalog = buildVoiceCatalog(
      [voiceFile('vits-piper-es_AR-daniela-high', 'es_AR-daniela-high.onnx')],
      undefined,
    );

    expect(catalog[0]?.isDefault).toBe(true);
    expect(DEFAULT_VOICE_ID).toBe('es_AR-daniela-high');
  });

  it('voiceModelId le saca la extension al nombre del archivo', () => {
    expect(voiceModelId('es_AR-daniela-high.onnx')).toBe('es_AR-daniela-high');
  });

  it('voiceModelConfigFileName nombra el sidecar de un modelo', () => {
    expect(voiceModelConfigFileName('es_AR-daniela-high.onnx')).toBe(
      'es_AR-daniela-high.onnx.json',
    );
  });

  it('voiceDirectoryName arma el nombre del directorio vits-piper-<id>', () => {
    expect(voiceDirectoryName('es_AR-daniela-high')).toBe('vits-piper-es_AR-daniela-high');
  });

  it('voiceIdFromDirectoryName es el inverso de voiceDirectoryName', () => {
    expect(voiceIdFromDirectoryName('vits-piper-es_AR-daniela-high')).toBe('es_AR-daniela-high');
  });

  it('voiceIdFromDirectoryName devuelve null para un directorio sin el prefijo esperado', () => {
    expect(voiceIdFromDirectoryName('es_AR-daniela-high')).toBeNull();
  });
});
