import { describe, expect, it } from 'vitest';

import type { VoiceTarget } from '@video-maker/timeline-core';

import { readFixture } from '../__fixtures__/load-fixture';
import { CommandFailedError } from '../errors/command-failed-error';
import { UnparseableOutputError } from '../errors/unparseable-output-error';
import { FixtureCommandRunner } from '../runner/fixture-command-runner';
import { DEFAULT_VOICE_TARGET, measureLoudness } from './measure-loudness';
import { buildLoudnormFilter } from './build-loudnorm-filter';
import { normalizeVoice } from './normalize-voice';
import { extractTrailingJsonObject, parseLoudnormJson } from './parse-loudnorm-json';

const loudnormStderr = readFixture('ffmpeg/loudnorm.stderr.txt');
const loudnormJson = readFixture('ffmpeg/loudnorm.json');

const EXPECTED_MEASUREMENT = {
  integratedLufs: -23.45,
  truePeakDbtp: -5.2,
  loudnessRange: 7.6,
  thresholdLufs: -33.99,
  targetOffsetDb: -0.03,
};

describe('parseLoudnormJson (CA-020)', () => {
  it('parsea el stderr completo de la primera pasada', () => {
    expect(parseLoudnormJson(loudnormStderr)).toEqual(EXPECTED_MEASUREMENT);
  });

  it('parsea el objeto JSON pelado de forma idéntica al stderr completo', () => {
    expect(parseLoudnormJson(loudnormJson)).toEqual(parseLoudnormJson(loudnormStderr));
  });

  it('lanza UnparseableOutputError cuando el texto no contiene JSON', () => {
    expect(() => parseLoudnormJson('no hay nada util aca')).toThrow(UnparseableOutputError);
  });

  it('lanza UnparseableOutputError cuando el bloque final no es JSON valido', () => {
    const broken = ['[Parsed_loudnorm_0 @ 0x1]', '{', '"input_i" : "-23.45",', '"input_tp"'].join('\n');

    expect(() => parseLoudnormJson(broken)).toThrow(UnparseableOutputError);
  });

  it('lanza UnparseableOutputError cuando el JSON es valido pero no cumple el schema', () => {
    const missingFields = JSON.stringify({ input_tp: '-5.20' });

    expect(() => parseLoudnormJson(missingFields)).toThrow(UnparseableOutputError);
  });

  it('lanza UnparseableOutputError nombrando el campo cuando input_i es "-inf"', () => {
    const silentAudio = JSON.stringify({
      input_i: '-inf',
      input_tp: '-5.20',
      input_lra: '7.60',
      input_thresh: '-inf',
      target_offset: '-0.03',
    });

    try {
      parseLoudnormJson(silentAudio);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnparseableOutputError);
      expect((error as UnparseableOutputError).reason).toContain('input_i');
    }
  });

  it('extractTrailingJsonObject devuelve undefined cuando no hay linea que empiece con "{"', () => {
    expect(extractTrailingJsonObject('frame=  120 fps=30 speed=8x')).toBeUndefined();
  });

  it('extractTrailingJsonObject toma la ULTIMA apertura de linea y el ULTIMO cierre', () => {
    const text = [
      'ruta con { llave rara',
      '{',
      '  "input_i" : "-23.45",',
      '  "input_tp" : "-5.20",',
      '  "input_lra" : "7.60",',
      '  "input_thresh" : "-33.99",',
      '  "target_offset" : "-0.03"',
      '}',
    ].join('\n');

    const extracted = extractTrailingJsonObject(text);
    expect(extracted).toBeDefined();
    expect(JSON.parse(extracted as string)).toEqual({
      input_i: '-23.45',
      input_tp: '-5.20',
      input_lra: '7.60',
      input_thresh: '-33.99',
      target_offset: '-0.03',
    });
  });
});

describe('measureLoudness (CA-020)', () => {
  it('llama a ffmpeg con los argumentos exactos de la tabla 4.3 y devuelve la medicion parseada', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: loudnormStderr, exitCode: 0 } },
    ]);

    const measured = await measureLoudness('voice-take-01.wav', runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-i',
      'voice-take-01.wav',
      '-af',
      'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ]);
    expect(measured).toEqual(EXPECTED_MEASUREMENT);
  });

  it('usa DEFAULT_VOICE_TARGET cuando no se pasa target', () => {
    expect(DEFAULT_VOICE_TARGET).toEqual({ integratedLufs: -14, truePeakDbtp: -1, loudnessRange: 11 });
  });

  it('arma el filtro con un target no default', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: loudnormStderr, exitCode: 0 } },
    ]);
    const target: VoiceTarget = { integratedLufs: -16, truePeakDbtp: -2, loudnessRange: 9 };

    await measureLoudness('voice-take-01.wav', runner, { target });

    expect(runner.calls[0]?.args[5]).toBe('loudnorm=I=-16:TP=-2:LRA=9:print_format=json');
  });

  it('propaga CommandFailedError cuando ffmpeg termina con exitCode distinto de 0', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'Invalid data found', exitCode: 1 } },
    ]);

    await expect(measureLoudness('voice-take-01.wav', runner)).rejects.toBeInstanceOf(CommandFailedError);
  });

  it('lanza UnparseableOutputError nombrando input_i cuando la medicion es "-inf"', async () => {
    const silentStderr = JSON.stringify({
      input_i: '-inf',
      input_tp: '-5.20',
      input_lra: '7.60',
      input_thresh: '-inf',
      target_offset: '-0.03',
    });
    const runner = new FixtureCommandRunner([{ bin: 'ffmpeg', response: { stderr: silentStderr, exitCode: 0 } }]);

    await expect(measureLoudness('silence.wav', runner)).rejects.toThrow(UnparseableOutputError);
  });

  it('respeta ffmpegPath y runOptions', async () => {
    const runner = new FixtureCommandRunner([
      { bin: '/opt/homebrew/bin/ffmpeg', response: { stderr: loudnormStderr, exitCode: 0 } },
    ]);

    await measureLoudness('voice-take-01.wav', runner, {
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.bin).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
  });
});

describe('buildLoudnormFilter (D-16)', () => {
  it('produce el filtro de medicion sin measured', () => {
    expect(buildLoudnormFilter(DEFAULT_VOICE_TARGET)).toBe('loudnorm=I=-14:TP=-1:LRA=11:print_format=json');
  });

  it('produce el filtro de aplicacion con measured y linear=true, en el orden fijo', () => {
    const filter = buildLoudnormFilter(DEFAULT_VOICE_TARGET, EXPECTED_MEASUREMENT);

    expect(filter).toBe(
      'loudnorm=I=-14:TP=-1:LRA=11:measured_I=-23.45:measured_TP=-5.20:measured_LRA=7.60:measured_thresh=-33.99:offset=-0.03:linear=true:print_format=json',
    );
  });
});

describe('normalizeVoice (CA-020)', () => {
  function buildTwoPassRunner(): FixtureCommandRunner {
    return new FixtureCommandRunner([
      {
        bin: 'ffmpeg',
        argsPattern: ['-af', /^loudnorm=(?!.*measured_I)/],
        response: { stderr: loudnormStderr, exitCode: 0 },
      },
      {
        bin: 'ffmpeg',
        argsPattern: ['-af', /measured_I=/],
        response: { stderr: '', exitCode: 0 },
      },
    ]);
  }

  it('ejecuta exactamente dos pasadas (RN-4)', async () => {
    const runner = buildTwoPassRunner();

    await normalizeVoice('voice-take-01.wav', 'voice-take-01.norm.wav', DEFAULT_VOICE_TARGET, runner);

    expect(runner.calls.length).toBe(2);
  });

  it('la primera pasada usa exactamente los argumentos de la tabla 4.3', async () => {
    const runner = buildTwoPassRunner();

    await normalizeVoice('voice-take-01.wav', 'voice-take-01.norm.wav', DEFAULT_VOICE_TARGET, runner);

    expect(runner.calls[0]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-i',
      'voice-take-01.wav',
      '-af',
      'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ]);
  });

  it('la segunda pasada usa measured_I/TP/LRA/thresh de la primera pasada y el target', async () => {
    const runner = buildTwoPassRunner();

    const result = await normalizeVoice(
      'voice-take-01.wav',
      'voice-take-01.norm.wav',
      DEFAULT_VOICE_TARGET,
      runner,
    );

    const secondPassFilter = runner.calls[1]?.args[6];
    expect(secondPassFilter).toBe(
      'loudnorm=I=-14:TP=-1:LRA=11:measured_I=-23.45:measured_TP=-5.20:measured_LRA=7.60:measured_thresh=-33.99:offset=-0.03:linear=true:print_format=json',
    );
    expect(secondPassFilter).toContain('measured_I=-23.45');
    expect(secondPassFilter).toContain('measured_TP=-5.20');
    expect(secondPassFilter).toContain('measured_LRA=7.60');
    expect(secondPassFilter).toContain('measured_thresh=-33.99');
    expect(secondPassFilter).toContain('I=-14');
    expect(secondPassFilter).toContain('TP=-1');
    expect(secondPassFilter).toContain('LRA=11');

    expect(runner.calls[1]?.args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      'voice-take-01.wav',
      '-af',
      secondPassFilter,
      '-ar',
      '48000',
      'voice-take-01.norm.wav',
    ]);

    expect(result.measured).toEqual(EXPECTED_MEASUREMENT);
    expect(result.filter).toBe(secondPassFilter);
    expect(result.outputPath).toBe('voice-take-01.norm.wav');
  });

  it('usa un target no default en ambas pasadas', async () => {
    const runner = buildTwoPassRunner();
    const target: VoiceTarget = { integratedLufs: -16, truePeakDbtp: -2, loudnessRange: 9 };

    await normalizeVoice('voice-take-01.wav', 'voice-take-01.norm.wav', target, runner);

    expect(runner.calls[0]?.args[5]).toBe('loudnorm=I=-16:TP=-2:LRA=9:print_format=json');
    expect(runner.calls[1]?.args[6]).toContain('I=-16:TP=-2:LRA=9:');
  });

  it('respeta sampleRate no default', async () => {
    const runner = buildTwoPassRunner();

    await normalizeVoice('voice-take-01.wav', 'voice-take-01.norm.wav', DEFAULT_VOICE_TARGET, runner, {
      sampleRate: 44100,
    });

    expect(runner.calls[1]?.args).toContain('44100');
  });

  it('reenvia runOptions a ambas pasadas', async () => {
    const runner = buildTwoPassRunner();

    await normalizeVoice('voice-take-01.wav', 'voice-take-01.norm.wav', DEFAULT_VOICE_TARGET, runner, {
      runOptions: { timeoutMs: 5000 },
    });

    expect(runner.calls[0]?.opts).toEqual({ timeoutMs: 5000 });
    expect(runner.calls[1]?.opts).toEqual({ timeoutMs: 5000 });
  });

  it('propaga CommandFailedError cuando la primera pasada falla', async () => {
    const runner = new FixtureCommandRunner([
      { bin: 'ffmpeg', response: { stderr: 'Invalid data found', exitCode: 1 } },
    ]);

    await expect(
      normalizeVoice('voice-take-01.wav', 'voice-take-01.norm.wav', DEFAULT_VOICE_TARGET, runner),
    ).rejects.toBeInstanceOf(CommandFailedError);
  });

  it('propaga CommandFailedError cuando la segunda pasada falla', async () => {
    const runner = new FixtureCommandRunner([
      {
        bin: 'ffmpeg',
        argsPattern: ['-af', /^loudnorm=(?!.*measured_I)/],
        response: { stderr: loudnormStderr, exitCode: 0 },
      },
      {
        bin: 'ffmpeg',
        argsPattern: ['-af', /measured_I=/],
        response: { stderr: 'disk full', exitCode: 1 },
      },
    ]);

    await expect(
      normalizeVoice('voice-take-01.wav', 'voice-take-01.norm.wav', DEFAULT_VOICE_TARGET, runner),
    ).rejects.toBeInstanceOf(CommandFailedError);
  });
});
