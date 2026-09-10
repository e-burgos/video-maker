import { describe, expect, it } from 'vitest';

import { BinaryNotFoundError } from '../errors/binary-not-found-error';
import { CommandFailedError } from '../errors/command-failed-error';
import type { BinaryLookup } from '../fs/binary-lookup';
import { BINARY_ENV_VARS, resolveBinary, resolveVoiceBinaries } from '../binaries/resolve-binaries';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { buildVoiceCatalog, voiceModelId } from './build-voice-catalog';
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

describe('buildVoiceCatalog (US-09-003)', () => {
  it('lista los .onnx ordenados por id y marca el modelo configurado como default', () => {
    const catalog = buildVoiceCatalog(
      ['es_ES-sharvard-medium.onnx', 'es_AR-daniela-high.onnx', 'en_US-lessac-high.onnx'],
      DEFAULT_MODEL,
    );

    expect(catalog).toEqual([
      { id: 'en_US-lessac-high', fileName: 'en_US-lessac-high.onnx', isDefault: false },
      { id: 'es_AR-daniela-high', fileName: 'es_AR-daniela-high.onnx', isDefault: true },
      { id: 'es_ES-sharvard-medium', fileName: 'es_ES-sharvard-medium.onnx', isDefault: false },
    ]);
  });

  it('descarta los .onnx.json de configuración y cualquier otro archivo del directorio', () => {
    const catalog = buildVoiceCatalog(
      ['es_AR-daniela-high.onnx', 'es_AR-daniela-high.onnx.json', 'README.md', '.onnx'],
      DEFAULT_MODEL,
    );

    expect(catalog.map((voice) => voice.fileName)).toEqual(['es_AR-daniela-high.onnx']);
  });

  it('sin ningún .onnx presente devuelve una lista vacía', () => {
    expect(buildVoiceCatalog(['README.md'], DEFAULT_MODEL)).toEqual([]);
  });

  it('ninguna voz es default cuando el modelo configurado no está en el directorio', () => {
    const catalog = buildVoiceCatalog(['en_US-lessac-high.onnx'], DEFAULT_MODEL);

    expect(catalog.every((voice) => !voice.isDefault)).toBe(true);
  });

  it('voiceModelId le saca la extensión al nombre del archivo', () => {
    expect(voiceModelId('es_AR-daniela-high.onnx')).toBe('es_AR-daniela-high');
  });
});
