import { describe, expect, it } from 'vitest';

import { BinaryNotFoundError } from '../errors/binary-not-found-error';
import type { BinaryLookup } from '../fs/binary-lookup';
import { BINARY_ENV_VARS, resolveBinaries, resolveBinary, resolveVoiceBinaries } from './resolve-binaries';

function fakeLookup(existingFiles: readonly string[], existingDirectories: readonly string[] = []): BinaryLookup {
  const files = new Set(existingFiles);
  const directories = new Set(existingDirectories);
  return {
    isExecutableFile: (path) => Promise.resolve(files.has(path)),
    isReadableFile: (path) => Promise.resolve(files.has(path)),
    isReadableDirectory: (path) => Promise.resolve(directories.has(path)),
  };
}

describe('resolveBinary (CA-021)', () => {
  it('la variable de entorno gana sobre el PATH', async () => {
    const lookup = fakeLookup(['/opt/custom/ffprobe', '/usr/bin/ffprobe']);
    const env = { FFPROBE_PATH: '/opt/custom/ffprobe', PATH: '/usr/bin' };

    await expect(resolveBinary('ffprobe', env, { lookup })).resolves.toBe('/opt/custom/ffprobe');
  });

  it('sin variable de entorno cae al PATH respetando su orden', async () => {
    const lookup = fakeLookup(['/opt/homebrew/bin/ffprobe']);
    const env = { PATH: '/usr/bin:/opt/homebrew/bin' };

    await expect(resolveBinary('ffprobe', env, { lookup })).resolves.toBe('/opt/homebrew/bin/ffprobe');
  });

  it('si existe en varios directorios del PATH gana el primero', async () => {
    const lookup = fakeLookup(['/usr/bin/ffprobe', '/opt/homebrew/bin/ffprobe']);
    const env = { PATH: '/usr/bin:/opt/homebrew/bin' };

    await expect(resolveBinary('ffprobe', env, { lookup })).resolves.toBe('/usr/bin/ffprobe');
  });

  it('una variable de entorno apuntando a una ruta inexistente no cae al PATH', async () => {
    const lookup = fakeLookup(['/usr/bin/ffmpeg']);
    const env = { FFMPEG_PATH: '/opt/broken/ffmpeg', PATH: '/usr/bin' };

    const error = await resolveBinary('ffmpeg', env, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    const binaryError = error as BinaryNotFoundError;
    expect(binaryError.binary).toBe('ffmpeg');
    expect(binaryError.envVar).toBe('FFMPEG_PATH');
    expect(binaryError.searchedPaths).toEqual(['/opt/broken/ffmpeg']);
  });

  it('nada configurado y nada en el PATH lanza BinaryNotFoundError con todos los candidatos', async () => {
    const lookup = fakeLookup([]);
    const env = { PATH: '/usr/bin:/opt/homebrew/bin' };

    const error = await resolveBinary('whisperCli', env, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    const binaryError = error as BinaryNotFoundError;
    expect(binaryError.binary).toBe('whisper-cli');
    expect(binaryError.searchedPaths).toEqual(['/usr/bin/whisper-cli', '/opt/homebrew/bin/whisper-cli']);
  });

  it('WHISPER_MODEL_PATH sin definir no tiene fallback al PATH', async () => {
    const lookup = fakeLookup([]);
    const env = { PATH: '/usr/bin' };

    const error = await resolveBinary('whisperModel', env, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    const binaryError = error as BinaryNotFoundError;
    expect(binaryError.binary).toBe('whisper-model');
    expect(binaryError.envVar).toBe('WHISPER_MODEL_PATH');
    expect(binaryError.searchedPaths).toEqual([]);
  });

  it('WHISPER_MODEL_PATH definido a un archivo legible se resuelve chequeando isReadableFile', async () => {
    const lookup = fakeLookup(['/models/ggml-large-v3-turbo.bin']);
    const env = { WHISPER_MODEL_PATH: '/models/ggml-large-v3-turbo.bin' };

    await expect(resolveBinary('whisperModel', env, { lookup })).resolves.toBe(
      '/models/ggml-large-v3-turbo.bin',
    );
  });

  it('sin PATH en el entorno no hay directorios donde buscar y lanza BinaryNotFoundError', async () => {
    const lookup = fakeLookup([]);

    const error = await resolveBinary('ffmpeg', {}, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    expect((error as BinaryNotFoundError).searchedPaths).toEqual([]);
  });

  it('sin opts usa nodeBinaryLookup por default y no encuentra nada sobre un PATH inexistente', async () => {
    const env = { PATH: '/this/path/does/not/exist-media-local-test' };

    const error = await resolveBinary('ffprobe', env).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
  });
});

describe('resolveBinary con VIDEO_MAKER_BIN_DIR (D-C3-07)', () => {
  it('un ejecutable bundleado gana al PATH cuando no hay variable específica', async () => {
    const lookup = fakeLookup(['/app/bin/ffmpeg', '/usr/bin/ffmpeg']);
    const env = { VIDEO_MAKER_BIN_DIR: '/app/bin', PATH: '/usr/bin' };

    await expect(resolveBinary('ffmpeg', env, { lookup })).resolves.toBe('/app/bin/ffmpeg');
  });

  it('la variable de entorno especifica sigue ganando al directorio bundleado', async () => {
    const lookup = fakeLookup(['/app/bin/ffmpeg', '/opt/custom/ffmpeg']);
    const env = { VIDEO_MAKER_BIN_DIR: '/app/bin', FFMPEG_PATH: '/opt/custom/ffmpeg' };

    await expect(resolveBinary('ffmpeg', env, { lookup })).resolves.toBe('/opt/custom/ffmpeg');
  });

  it('si el bundleado no existe cae al PATH', async () => {
    const lookup = fakeLookup(['/usr/bin/ffmpeg']);
    const env = { VIDEO_MAKER_BIN_DIR: '/app/bin', PATH: '/usr/bin' };

    await expect(resolveBinary('ffmpeg', env, { lookup })).resolves.toBe('/usr/bin/ffmpeg');
  });

  it('el error final lista el candidato bundleado antes que los del PATH', async () => {
    const lookup = fakeLookup([]);
    const env = { VIDEO_MAKER_BIN_DIR: '/app/bin', PATH: '/usr/bin' };

    const error = await resolveBinary('ffmpeg', env, { lookup }).catch((err: unknown) => err);

    expect((error as BinaryNotFoundError).searchedPaths).toEqual(['/app/bin/ffmpeg', '/usr/bin/ffmpeg']);
  });
});

describe('resolveBinary con VIDEO_MAKER_MODELS_DIR (D-C3-07)', () => {
  it('el modelo de whisper se resuelve dentro de la carpeta de datos cuando falta la variable especifica', async () => {
    const lookup = fakeLookup(['/data/whisper-model.bin']);
    const env = { VIDEO_MAKER_MODELS_DIR: '/data' };

    await expect(resolveBinary('whisperModel', env, { lookup })).resolves.toBe('/data/whisper-model.bin');
  });

  it('WHISPER_MODEL_PATH sigue ganando a la carpeta de datos', async () => {
    const lookup = fakeLookup(['/data/whisper-model.bin', '/opt/model.bin']);
    const env = { VIDEO_MAKER_MODELS_DIR: '/data', WHISPER_MODEL_PATH: '/opt/model.bin' };

    await expect(resolveBinary('whisperModel', env, { lookup })).resolves.toBe('/opt/model.bin');
  });

  it('el directorio de voces se resuelve como directorio, no como archivo', async () => {
    const lookup = fakeLookup([], ['/data/voices']);
    const env = { VIDEO_MAKER_MODELS_DIR: '/data' };

    await expect(resolveBinary('ttsVoicesDir', env, { lookup })).resolves.toBe('/data/voices');
  });

  it('sin la carpeta de datos y sin variable especifica lanza BinaryNotFoundError sin candidatos', async () => {
    const lookup = fakeLookup([]);
    const env = {};

    const error = await resolveBinary('whisperModel', env, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    expect((error as BinaryNotFoundError).searchedPaths).toEqual([]);
  });
});

describe('resolveBinary para el motor de voz sherpa-onnx', () => {
  it('TTS_CLI_PATH gana sobre el PATH, igual que el resto de los binarios', async () => {
    const lookup = fakeLookup(['/opt/tts/bin/sherpa-onnx-offline-tts', '/usr/bin/sherpa-onnx-offline-tts']);
    const env = { TTS_CLI_PATH: '/opt/tts/bin/sherpa-onnx-offline-tts', PATH: '/usr/bin' };

    await expect(resolveBinary('ttsCli', env, { lookup })).resolves.toBe(
      '/opt/tts/bin/sherpa-onnx-offline-tts',
    );
  });

  it('sin TTS_CLI_PATH cae al PATH buscando sherpa-onnx-offline-tts', async () => {
    const lookup = fakeLookup(['/opt/homebrew/bin/sherpa-onnx-offline-tts']);
    const env = { PATH: '/usr/bin:/opt/homebrew/bin' };

    await expect(resolveBinary('ttsCli', env, { lookup })).resolves.toBe(
      '/opt/homebrew/bin/sherpa-onnx-offline-tts',
    );
  });

  it('TTS_VOICES_DIR sin definir NO tiene fallback al PATH, igual que el modelo de whisper', async () => {
    const lookup = fakeLookup([], ['/home/dev/.cache/tts-voices']);
    const env = { PATH: '/usr/bin' };

    const error = await resolveBinary('ttsVoicesDir', env, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    const binaryError = error as BinaryNotFoundError;
    expect(binaryError.binary).toBe('tts-voices');
    expect(binaryError.envVar).toBe('TTS_VOICES_DIR');
    expect(binaryError.searchedPaths).toEqual([]);
  });

  it('TTS_VOICES_DIR se valida como directorio legible, no como ejecutable', async () => {
    const readableDirOnly: BinaryLookup = {
      isExecutableFile: () => Promise.resolve(false),
      isReadableFile: () => Promise.resolve(false),
      isReadableDirectory: (path) => Promise.resolve(path === '/home/dev/.cache/tts-voices'),
    };
    const env = { TTS_VOICES_DIR: '/home/dev/.cache/tts-voices' };

    await expect(resolveBinary('ttsVoicesDir', env, { lookup: readableDirOnly })).resolves.toBe(
      '/home/dev/.cache/tts-voices',
    );
  });

  it('publica las dos variables de entorno nuevas en BINARY_ENV_VARS', () => {
    expect(BINARY_ENV_VARS.ttsCli).toBe('TTS_CLI_PATH');
    expect(BINARY_ENV_VARS.ttsVoicesDir).toBe('TTS_VOICES_DIR');
  });
});

describe('resolveBinaries (CA-021)', () => {
  it('resuelve los cuatro binarios', async () => {
    const lookup = fakeLookup([
      '/usr/bin/ffprobe',
      '/usr/bin/ffmpeg',
      '/usr/bin/whisper-cli',
      '/models/model.bin',
    ]);
    const env = { PATH: '/usr/bin', WHISPER_MODEL_PATH: '/models/model.bin' };

    await expect(resolveBinaries(env, { lookup })).resolves.toEqual({
      ffmpeg: '/usr/bin/ffmpeg',
      ffprobe: '/usr/bin/ffprobe',
      whisperCli: '/usr/bin/whisper-cli',
      whisperModel: '/models/model.bin',
    });
  });

  it('lanza en el primero que falta sin ejecutar ningún binario real', async () => {
    const lookup = fakeLookup(['/usr/bin/ffprobe']);
    const env = { PATH: '/usr/bin' };

    await expect(resolveBinaries(env, { lookup })).rejects.toBeInstanceOf(BinaryNotFoundError);
  });
});

describe('resolveVoiceBinaries (US-09-002)', () => {
  it('resuelve los cuatro binarios de montaje más el motor de voz y su directorio de voces', async () => {
    const lookup = fakeLookup(
      ['/usr/bin/ffprobe', '/usr/bin/ffmpeg', '/usr/bin/whisper-cli', '/models/model.bin', '/usr/bin/sherpa-onnx-offline-tts'],
      ['/home/dev/.cache/tts-voices'],
    );
    const env = {
      PATH: '/usr/bin',
      WHISPER_MODEL_PATH: '/models/model.bin',
      TTS_VOICES_DIR: '/home/dev/.cache/tts-voices',
    };

    await expect(resolveVoiceBinaries(env, { lookup })).resolves.toEqual({
      ffmpeg: '/usr/bin/ffmpeg',
      ffprobe: '/usr/bin/ffprobe',
      whisperCli: '/usr/bin/whisper-cli',
      whisperModel: '/models/model.bin',
      ttsCli: '/usr/bin/sherpa-onnx-offline-tts',
      ttsVoicesDir: '/home/dev/.cache/tts-voices',
    });
  });

  it('falta el directorio de voces y falla sin ejecutar ningún binario real', async () => {
    const lookup = fakeLookup([
      '/usr/bin/ffprobe',
      '/usr/bin/ffmpeg',
      '/usr/bin/whisper-cli',
      '/models/model.bin',
      '/usr/bin/sherpa-onnx-offline-tts',
    ]);
    const env = { PATH: '/usr/bin', WHISPER_MODEL_PATH: '/models/model.bin' };

    const error = await resolveVoiceBinaries(env, { lookup }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(BinaryNotFoundError);
    expect((error as BinaryNotFoundError).envVar).toBe('TTS_VOICES_DIR');
  });
});
