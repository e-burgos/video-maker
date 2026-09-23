import { describe, expect, it } from 'vitest';

import { CommandFailedError } from '../errors/command-failed-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { narrationToSingleLine, synthesizeSpeech } from './synthesize-speech';

const MODEL_PATH = '/home/dev/.cache/tts-voices/vits-piper-es_AR-daniela-high/es_AR-daniela-high.onnx';
const TOKENS_PATH = '/home/dev/.cache/tts-voices/vits-piper-es_AR-daniela-high/tokens.txt';
const DATA_DIR_PATH = '/home/dev/.cache/tts-voices/vits-piper-es_AR-daniela-high/espeak-ng-data';

function fakeReadTextFile(contents: string) {
  return () => Promise.resolve(contents);
}

describe('synthesizeSpeech (US-09-004, US-017-201)', () => {
  it('invoca sherpa-onnx-offline-tts con el modelo, los tokens, el directorio de datos y el texto', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'sherpa-onnx-offline-tts', response: { exitCode: 0 } }]);

    const out = await synthesizeSpeech(
      '/project/work/voice/sources/scene-01.wav',
      {
        modelPath: MODEL_PATH,
        tokensPath: TOKENS_PATH,
        dataDirPath: DATA_DIR_PATH,
        textPath: '/project/work/voice/sources/scene-01.txt',
        ttsPath: '/opt/tts/bin/sherpa-onnx-offline-tts',
        readTextFile: fakeReadTextFile('Hola, esto es una prueba.\n'),
        runOptions: { cwd: '/project' },
      },
      runner,
    );

    expect(out).toBe('/project/work/voice/sources/scene-01.wav');
    expect(runner.calls).toEqual([
      {
        bin: '/opt/tts/bin/sherpa-onnx-offline-tts',
        args: [
          `--vits-model=${MODEL_PATH}`,
          `--vits-tokens=${TOKENS_PATH}`,
          `--vits-data-dir=${DATA_DIR_PATH}`,
          '--output-filename=/project/work/voice/sources/scene-01.wav',
          'Hola, esto es una prueba.',
        ],
        opts: { cwd: '/project' },
      },
    ]);
  });

  it('pasa --vits-length-scale cuando se pide acelerar la locución (FIX-e-burgos-009-002)', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'sherpa-onnx-offline-tts', response: { exitCode: 0 } }]);

    await synthesizeSpeech(
      '/out.wav',
      {
        modelPath: MODEL_PATH,
        tokensPath: TOKENS_PATH,
        dataDirPath: DATA_DIR_PATH,
        textPath: '/in.txt',
        lengthScale: 0.88,
        readTextFile: fakeReadTextFile('Texto de prueba.'),
      },
      runner,
    );

    expect(runner.calls[0]?.args).toEqual([
      `--vits-model=${MODEL_PATH}`,
      `--vits-tokens=${TOKENS_PATH}`,
      `--vits-data-dir=${DATA_DIR_PATH}`,
      '--vits-length-scale',
      '0.88',
      '--output-filename=/out.wav',
      'Texto de prueba.',
    ]);
  });

  it('no pasa --vits-length-scale a velocidad natural (FIX-e-burgos-009-002)', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'sherpa-onnx-offline-tts', response: { exitCode: 0 } }]);

    await synthesizeSpeech(
      '/out.wav',
      {
        modelPath: MODEL_PATH,
        tokensPath: TOKENS_PATH,
        dataDirPath: DATA_DIR_PATH,
        textPath: '/in.txt',
        lengthScale: 1,
        readTextFile: fakeReadTextFile('Texto de prueba.'),
      },
      runner,
    );

    expect(runner.calls[0]?.args).not.toContain('--vits-length-scale');
  });

  it('colapsa saltos de línea del texto leído antes de pasarlo como argumento', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'sherpa-onnx-offline-tts', response: { exitCode: 0 } }]);

    await synthesizeSpeech(
      '/out.wav',
      {
        modelPath: MODEL_PATH,
        tokensPath: TOKENS_PATH,
        dataDirPath: DATA_DIR_PATH,
        textPath: '/in.txt',
        readTextFile: fakeReadTextFile('Primera oración.\nSegunda oración.\n\n  Tercera.  '),
      },
      runner,
    );

    expect(runner.calls[0]?.args.at(-1)).toBe('Primera oración. Segunda oración. Tercera.');
  });

  it('sin ttsPath usa el comando sherpa-onnx-offline-tts del PATH', async () => {
    const runner = new FixtureCommandRunner([{ bin: 'sherpa-onnx-offline-tts', response: { exitCode: 0 } }]);

    await synthesizeSpeech(
      '/out.wav',
      {
        modelPath: MODEL_PATH,
        tokensPath: TOKENS_PATH,
        dataDirPath: DATA_DIR_PATH,
        textPath: '/in.txt',
        readTextFile: fakeReadTextFile('Texto.'),
      },
      runner,
    );

    expect(runner.calls[0]?.bin).toBe('sherpa-onnx-offline-tts');
  });

  it('un exit code distinto de cero lanza CommandFailedError con el stderr del binario', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'sherpa-onnx-offline-tts', response: { exitCode: 1, stderr: 'Unable to load model' } },
    ]);

    const error = await synthesizeSpeech(
      '/out.wav',
      {
        modelPath: MODEL_PATH,
        tokensPath: TOKENS_PATH,
        dataDirPath: DATA_DIR_PATH,
        textPath: '/in.txt',
        readTextFile: fakeReadTextFile('Texto.'),
      },
      runner,
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(CommandFailedError);
    expect((error as CommandFailedError).exitCode).toBe(1);
  });
});

describe('narrationToSingleLine (US-09-004)', () => {
  it('colapsa los saltos de línea porque el motor trata cada línea como una emisión separada', () => {
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
