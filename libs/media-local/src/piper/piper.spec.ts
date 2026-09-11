import { describe, expect, it } from 'vitest';

import { BinaryNotFoundError } from '../errors/binary-not-found-error';
import { CommandFailedError } from '../errors/command-failed-error';
import type { BinaryLookup } from '../fs/binary-lookup';
import { BINARY_ENV_VARS, resolveBinary, resolveVoiceBinaries } from '../binaries/resolve-binaries';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { buildVoiceCatalog, voiceModelConfigFileName, voiceModelId } from './build-voice-catalog';
import { narrationToSingleLine, synthesizeSpeech } from './synthesize-speech';

function fakeLookup(existingPaths: readonly string[]): BinaryLookup {
  const existing = new Set(existingPaths);
  return {
    isExecutableFile: (path) => Promise.resolve(existing.has(path)),
    isReadableFile: (path) => Promise.resolve(existing.has(path)),
  };
}

const VOICES_DIR = '/home/dev/.cache/piper-voices';
const DEFAULT_MODEL = `${VOICES_DIR}/es_AR-daniela-high.onnx`;

describe('resolveBinary para Piper (US-09-002)', () => {
  it('PIPER_PATH gana sobre el PATH, igual que el resto de los binarios', async () => {
    const lookup = fakeLookup(['/opt/python/bin/piper', '/usr/bin/piper']);
    const env = { PIPER_PATH: '/opt/python/bin/piper', PATH: '/usr/bin' };

    await expect(resolveBinary('piperCli', env, { lookup })).resolves.toBe('/opt/python/bin/piper');
  });

  it('sin PIPER_PATH cae al PATH buscando el comando piper', async () => {
    const lookup = fakeLookup(['/opt/homebrew/bin/piper']);
    const env = { PATH: '/usr/bin:/opt/homebrew/bin' };

    await expect(resolveBinary('piperCli', env, { lookup })).resolves.toBe('/opt/homebrew/bin/piper');
  });

  it('PIPER_MODEL_PATH sin definir NO tiene fallback al PATH, igual que el modelo de whisper', async () => {
    const lookup = fakeLookup([DEFAULT_MODEL]);
    const env = { PATH: '/usr/bin' };

    const error = await resolveBinary('piperModel', env, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    const binaryError = error as BinaryNotFoundError;
    expect(binaryError.binary).toBe('piper-voice');
    expect(binaryError.envVar).toBe('PIPER_MODEL_PATH');
    expect(binaryError.searchedPaths).toEqual([]);
  });

  it('PIPER_MODEL_PATH se valida como archivo legible, no como ejecutable', async () => {
    const readableOnly: BinaryLookup = {
      isExecutableFile: () => Promise.resolve(false),
      isReadableFile: (path) => Promise.resolve(path === DEFAULT_MODEL),
    };
    const env = { PIPER_MODEL_PATH: DEFAULT_MODEL };

    await expect(resolveBinary('piperModel', env, { lookup: readableOnly })).resolves.toBe(DEFAULT_MODEL);
  });

  it('publica las dos variables de entorno nuevas en BINARY_ENV_VARS', () => {
    expect(BINARY_ENV_VARS.piperCli).toBe('PIPER_PATH');
    expect(BINARY_ENV_VARS.piperModel).toBe('PIPER_MODEL_PATH');
  });
});

describe('resolveVoiceBinaries (US-09-002)', () => {
  it('resuelve los cuatro binarios de montaje más los dos de Piper', async () => {
    const lookup = fakeLookup([
      '/usr/bin/ffprobe',
      '/usr/bin/ffmpeg',
      '/usr/bin/whisper-cli',
      '/models/model.bin',
      '/usr/bin/piper',
      DEFAULT_MODEL,
    ]);
    const env = {
      PATH: '/usr/bin',
      WHISPER_MODEL_PATH: '/models/model.bin',
      PIPER_MODEL_PATH: DEFAULT_MODEL,
    };

    await expect(resolveVoiceBinaries(env, { lookup })).resolves.toEqual({
      ffmpeg: '/usr/bin/ffmpeg',
      ffprobe: '/usr/bin/ffprobe',
      whisperCli: '/usr/bin/whisper-cli',
      whisperModel: '/models/model.bin',
      piperCli: '/usr/bin/piper',
      piperModel: DEFAULT_MODEL,
    });
  });

  it('falta la voz y falla sin ejecutar ningún binario real', async () => {
    const lookup = fakeLookup([
      '/usr/bin/ffprobe',
      '/usr/bin/ffmpeg',
      '/usr/bin/whisper-cli',
      '/models/model.bin',
      '/usr/bin/piper',
    ]);
    const env = { PATH: '/usr/bin', WHISPER_MODEL_PATH: '/models/model.bin' };

    const error = await resolveVoiceBinaries(env, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    expect((error as BinaryNotFoundError).envVar).toBe('PIPER_MODEL_PATH');
  });
});

describe('synthesizeSpeech (US-09-004)', () => {
  it('invoca piper con el modelo, el archivo de texto y el wav de salida', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'piper', response: { exitCode: 0 } }]);

    const out = await synthesizeSpeech(
      '/project/work/voice/sources/scene-01.wav',
      {
        modelPath: DEFAULT_MODEL,
        textPath: '/project/work/voice/sources/scene-01.txt',
        piperPath: '/opt/python/bin/piper',
        runOptions: { cwd: '/project' },
      },
      runner,
    );

    expect(out).toBe('/project/work/voice/sources/scene-01.wav');
    expect(runner.calls).toEqual([
      {
        bin: '/opt/python/bin/piper',
        args: [
          '-m',
          DEFAULT_MODEL,
          '-i',
          '/project/work/voice/sources/scene-01.txt',
          '-f',
          '/project/work/voice/sources/scene-01.wav',
        ],
        opts: { cwd: '/project' },
      },
    ]);
  });

  it('sin piperPath usa el comando piper del PATH', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'piper', response: { exitCode: 0 } }]);

    await synthesizeSpeech('/out.wav', { modelPath: DEFAULT_MODEL, textPath: '/in.txt' }, runner);

    expect(runner.calls[0]?.bin).toBe('piper');
  });

  it('un exit code distinto de cero lanza CommandFailedError con el stderr del binario', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'piper', response: { exitCode: 1, stderr: 'Unable to load model' } },
    ]);

    const error = await synthesizeSpeech(
      '/out.wav',
      { modelPath: DEFAULT_MODEL, textPath: '/in.txt' },
      runner,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(CommandFailedError);
    expect((error as CommandFailedError).exitCode).toBe(1);
  });
});

describe('narrationToSingleLine (US-09-004)', () => {
  it('colapsa los saltos de línea porque piper trata cada línea como una emisión separada', () => {
    expect(narrationToSingleLine('Primera oración.\nSegunda oración.\n\n  Tercera.  ')).toBe(
      'Primera oración. Segunda oración. Tercera.',
    );
  });

  it('deja intacta una narración que ya es una sola línea', () => {
    expect(narrationToSingleLine('Nx convierte un repo suelto en un monorepo.')).toBe(
      'Nx convierte un repo suelto en un monorepo.',
    );
  });
});

function voiceFile(fileName: string, config: unknown = null) {
  return { fileName, config };
}

const DANIELA_CONFIG = {
  dataset: 'daniela',
  audio: { sample_rate: 22050, quality: 'high' },
  language: {
    code: 'es_AR',
    family: 'es',
    region: 'AR',
    name_native: 'Espa\u00f1ol',
    name_english: 'Spanish',
    country_english: 'Argentina',
  },
};

describe('buildVoiceCatalog (US-09-003, US-016-001)', () => {
  it('lista los .onnx ordenados por id y marca el modelo configurado como default', () => {
    const catalog = buildVoiceCatalog(
      [
        voiceFile('es_ES-sharvard-medium.onnx'),
        voiceFile('es_AR-daniela-high.onnx'),
        voiceFile('en_US-lessac-high.onnx'),
      ],
      DEFAULT_MODEL,
    );

    expect(catalog.map((voice) => voice.id)).toEqual([
      'en_US-lessac-high',
      'es_AR-daniela-high',
      'es_ES-sharvard-medium',
    ]);
    expect(catalog.filter((voice) => voice.isDefault).map((voice) => voice.id)).toEqual([
      'es_AR-daniela-high',
    ]);
  });

  it('deriva idioma, calidad, etiqueta y descripcion de los metadatos del modelo', () => {
    const [voice] = buildVoiceCatalog(
      [voiceFile('es_AR-daniela-high.onnx', DANIELA_CONFIG)],
      DEFAULT_MODEL,
    );

    expect(voice).toEqual({
      id: 'es_AR-daniela-high',
      fileName: 'es_AR-daniela-high.onnx',
      isDefault: true,
      language: { code: 'es-AR', region: 'AR' },
      quality: 'high',
      label: 'Daniela \u00b7 Spanish (Argentina) \u00b7 High quality',
      description:
        'Neural voice trained on the "daniela" dataset. Spanish as spoken in Argentina, synthesized at 22050 Hz.',
    });
  });

  it('sin sidecar de metadatos cae al nombre del archivo y lo dice en la descripcion', () => {
    const [voice] = buildVoiceCatalog([voiceFile('en_US-lessac-high.onnx')], DEFAULT_MODEL);

    expect(voice?.language).toEqual({ code: 'en-US', region: 'US' });
    expect(voice?.quality).toBe('high');
    expect(voice?.label).toBe('Lessac \u00b7 en-US \u00b7 High quality');
    expect(voice?.description).toBe(
      'Derived from the model file name: this voice has no .onnx.json metadata next to it.',
    );
  });

  it('un sidecar corrupto se trata como ausente en vez de romper el catalogo', () => {
    const [voice] = buildVoiceCatalog(
      [voiceFile('es_MX-claude-high.onnx', 'not an object')],
      DEFAULT_MODEL,
    );

    expect(voice?.label).toBe('Claude \u00b7 es-MX \u00b7 High quality');
    expect(voice?.quality).toBe('high');
  });

  it('un nombre sin calidad reconocible publica quality null en vez de inventar una', () => {
    const [voice] = buildVoiceCatalog([voiceFile('custom.onnx')], DEFAULT_MODEL);

    expect(voice?.quality).toBeNull();
    expect(voice?.label).toBe('Custom \u00b7 custom');
  });

  it('los metadatos del sidecar ganan sobre lo que dice el nombre del archivo', () => {
    const [voice] = buildVoiceCatalog(
      [
        voiceFile('es_AR-daniela-high.onnx', {
          ...DANIELA_CONFIG,
          audio: { sample_rate: 22050, quality: 'medium' },
        }),
      ],
      DEFAULT_MODEL,
    );

    expect(voice?.quality).toBe('medium');
  });

  it('descarta los .onnx.json de configuracion y cualquier otro archivo del directorio', () => {
    const catalog = buildVoiceCatalog(
      [
        voiceFile('es_AR-daniela-high.onnx'),
        voiceFile('es_AR-daniela-high.onnx.json'),
        voiceFile('README.md'),
        voiceFile('.onnx'),
      ],
      DEFAULT_MODEL,
    );

    expect(catalog.map((voice) => voice.fileName)).toEqual(['es_AR-daniela-high.onnx']);
  });

  it('sin ningun .onnx presente devuelve una lista vacia', () => {
    expect(buildVoiceCatalog([voiceFile('README.md')], DEFAULT_MODEL)).toEqual([]);
  });

  it('ninguna voz es default cuando el modelo configurado no esta en el directorio', () => {
    const catalog = buildVoiceCatalog([voiceFile('en_US-lessac-high.onnx')], DEFAULT_MODEL);

    expect(catalog.every((voice) => !voice.isDefault)).toBe(true);
  });

  it('voiceModelId le saca la extension al nombre del archivo', () => {
    expect(voiceModelId('es_AR-daniela-high.onnx')).toBe('es_AR-daniela-high');
  });

  it('voiceModelConfigFileName nombra el sidecar de un modelo', () => {
    expect(voiceModelConfigFileName('es_AR-daniela-high.onnx')).toBe(
      'es_AR-daniela-high.onnx.json',
    );
  });
});
