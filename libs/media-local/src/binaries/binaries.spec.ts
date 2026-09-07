import { describe, expect, it } from 'vitest';

import { BinaryNotFoundError } from '../errors/binary-not-found-error';
import type { BinaryLookup } from '../fs/binary-lookup';
import { resolveBinaries, resolveBinary } from './resolve-binaries';

function fakeLookup(existingPaths: readonly string[]): BinaryLookup {
  const existing = new Set(existingPaths);
  return {
    isExecutableFile: (path) => Promise.resolve(existing.has(path)),
    isReadableFile: (path) => Promise.resolve(existing.has(path)),
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
