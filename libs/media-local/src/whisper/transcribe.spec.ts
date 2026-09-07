import { describe, expect, it, vi } from 'vitest';

import { readFixture } from '../__fixtures__/load-fixture';
import { CommandFailedError } from '../errors/command-failed-error';
import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { parseWhisperCppJson } from './parse-whisper-cpp-json';
import { transcribeWithWhisperCpp } from './transcribe-with-whisper-cpp';

const ASSET_ID = 'voice-take-01';
const MODEL_PATH = '/models/ggml-large-v3-turbo.bin';
const OUT_BASE = '/tmp/voice-take-01';
const whisperCppRaw = readFixture('whisper/whisper-cpp.json');

function fixtureReadTextFile(raw: string): (path: string) => Promise<string> {
  return vi.fn(async () => raw);
}

describe('transcribeWithWhisperCpp', () => {
  it('llama a whisper-cli con los argumentos exactos de la tabla usando el default de language', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'whisper-cli', response: { exitCode: 0 } }]);

    await transcribeWithWhisperCpp('input.wav', {
      modelPath: MODEL_PATH,
      outBase: OUT_BASE,
      assetId: ASSET_ID,
      readTextFile: fixtureReadTextFile(whisperCppRaw),
    }, runner);

    expect(runner.calls[0]?.args).toEqual([
      '-m',
      MODEL_PATH,
      '-f',
      'input.wav',
      '-oj',
      '-ml',
      '1',
      '-l',
      'auto',
      '-of',
      OUT_BASE,
    ]);
  });

  it('el readTextFile inyectado recibe exactamente `${outBase}.json`', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'whisper-cli', response: { exitCode: 0 } }]);
    const readTextFile = fixtureReadTextFile(whisperCppRaw);

    await transcribeWithWhisperCpp('input.wav', {
      modelPath: MODEL_PATH,
      outBase: OUT_BASE,
      assetId: ASSET_ID,
      readTextFile,
    }, runner);

    expect(readTextFile).toHaveBeenCalledWith(`${OUT_BASE}.json`);
  });

  it('el resultado es igual al del parser puro sobre la misma fixture', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'whisper-cli', response: { exitCode: 0 } }]);

    const result = await transcribeWithWhisperCpp('input.wav', {
      modelPath: MODEL_PATH,
      outBase: OUT_BASE,
      assetId: ASSET_ID,
      readTextFile: fixtureReadTextFile(whisperCppRaw),
    }, runner);

    const expected = parseWhisperCppJson(whisperCppRaw, ASSET_ID, {
      model: 'ggml-large-v3-turbo.bin',
    });

    expect(result).toEqual(expected);
  });

  it('pasa un language explícito a whisper-cli y lo fuerza como override del parser', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'whisper-cli', response: { exitCode: 0 } }]);

    const result = await transcribeWithWhisperCpp('input.wav', {
      modelPath: MODEL_PATH,
      outBase: OUT_BASE,
      assetId: ASSET_ID,
      language: 'en',
      readTextFile: fixtureReadTextFile(whisperCppRaw),
    }, runner);

    expect(runner.calls[0]?.args[8]).toBe('en');
    expect(result.language).toBe('en');
  });

  it('propaga CommandFailedError cuando whisper-cli falla', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'whisper-cli', response: { stderr: 'model load failed', exitCode: 1 } },
    ]);

    const failure = transcribeWithWhisperCpp('input.wav', {
      modelPath: MODEL_PATH,
      outBase: OUT_BASE,
      assetId: ASSET_ID,
      readTextFile: fixtureReadTextFile(whisperCppRaw),
    }, runner);

    await expect(failure).rejects.toBeInstanceOf(CommandFailedError);
  });

  it('traduce un fallo de lectura del archivo de salida a UnparseableOutputError', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'whisper-cli', response: { stdout: 'whisper_print_timings: ...', exitCode: 0 } },
    ]);
    const readTextFile = vi.fn(async () => {
      throw new Error('ENOENT: no such file or directory');
    });

    const failure = transcribeWithWhisperCpp('input.wav', {
      modelPath: MODEL_PATH,
      outBase: OUT_BASE,
      assetId: ASSET_ID,
      readTextFile,
    }, runner);

    await expect(failure).rejects.toBeInstanceOf(UnparseableOutputError);
    await expect(failure).rejects.toMatchObject({ command: 'whisper.cpp' });
  });

  it('no ejecuta ningún proceso ni toca el filesystem real: el único I/O es la fixture inyectada', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'whisper-cli', response: { exitCode: 0 } }]);
    const readTextFile = fixtureReadTextFile(whisperCppRaw);

    await transcribeWithWhisperCpp('input.wav', {
      modelPath: MODEL_PATH,
      outBase: OUT_BASE,
      assetId: ASSET_ID,
      readTextFile,
    }, runner);

    expect(runner.calls).toHaveLength(1);
    expect(readTextFile).toHaveBeenCalledTimes(1);
  });
});
