import { describe, expect, it } from 'vitest';

import { CliArgumentError } from '../errors/cli-argument-error';
import { CliUsageError } from '../errors/cli-usage-error';

import { parseCliArgs } from './parse-cli-args';

function captureThrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected function to throw');
}

describe('parseCliArgs — success paths', () => {
  it('parses ingest with only the project root', () => {
    expect(parseCliArgs(['ingest', 'media/p'])).toEqual({ command: 'ingest', projectRoot: 'media/p' });
  });

  it('parses render with only the project root', () => {
    expect(parseCliArgs(['render', 'media/p'])).toEqual({ command: 'render', projectRoot: 'media/p' });
  });

  it('parses plan with a preset and defaults the seed to 0', () => {
    expect(parseCliArgs(['plan', 'media/p', '--preset', 'hardware'])).toEqual({
      command: 'plan',
      projectRoot: 'media/p',
      options: { preset: 'hardware', seed: 0, scriptPath: null, logo: 'auto', format: 'reels-9x16', voice: 'aroll', pruneSilences: undefined },
    });
  });

  it('parses plan with an explicit seed', () => {
    expect(parseCliArgs(['plan', 'media/p', '--preset', 'recipe', '--seed', '42'])).toEqual({
      command: 'plan',
      projectRoot: 'media/p',
      options: { preset: 'recipe', seed: 42, scriptPath: null, logo: 'auto', format: 'reels-9x16', voice: 'aroll', pruneSilences: undefined },
    });
  });

  it('parses run with a preset and an explicit seed', () => {
    expect(parseCliArgs(['run', 'media/p', '--preset', 'educational', '--seed', '3'])).toEqual({
      command: 'run',
      projectRoot: 'media/p',
      options: { preset: 'educational', seed: 3, scriptPath: null, logo: 'auto', format: 'reels-9x16', voice: 'aroll', pruneSilences: undefined },
    });
  });
});

describe('parseCliArgs — the 8-step validation order of §4.1', () => {
  it('step 1: no tokens at all -> missing-command, stage null', () => {
    const error = captureThrown(() => parseCliArgs([]));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('missing-command');
    expect((error as CliUsageError).stage).toBeNull();
  });

  it('step 2: unknown command -> unknown-command, carrying the offending token and no stage', () => {
    const error = captureThrown(() => parseCliArgs(['rnder', 'media/p']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unknown-command');
    expect((error as CliUsageError).resource).toBe('rnder');
    expect((error as CliUsageError).stage).toBeNull();
  });

  it('step 3: an unknown option surfaces node:util parseArgs ERR_PARSE_ARGS_UNKNOWN_OPTION as unknown-option, carrying the recognized command stage', () => {
    const error = captureThrown(() => parseCliArgs(['ingest', 'media/p', '--bogus']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unknown-option');
    expect((error as CliUsageError).stage).toBe('ingest');
  });

  it('step 3: a string option without a value surfaces ERR_PARSE_ARGS_INVALID_OPTION_VALUE, carrying the recognized command stage', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('invalid-option-value');
    expect((error as CliUsageError).stage).toBe('plan');
  });

  it('step 4: missing the project root positional -> missing-project-root, carrying the recognized command stage', () => {
    const error = captureThrown(() => parseCliArgs(['ingest']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('missing-project-root');
    expect((error as CliUsageError).stage).toBe('ingest');
  });

  it('step 4: an extra positional -> unexpected-positional, before the preset/seed checks, carrying the recognized command stage', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', 'extra']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unexpected-positional');
    expect((error as CliUsageError).resource).toBe('extra');
    expect((error as CliUsageError).stage).toBe('plan');
  });

  it('step 4 wins over step 5: an extra positional beats an unexpected --preset on ingest', () => {
    const error = captureThrown(() => parseCliArgs(['ingest', 'media/p', 'extra', '--preset', 'hardware']));
    expect((error as CliUsageError).reason).toBe('unexpected-positional');
  });

  it('step 5: --preset on ingest is unexpected-option, not a CliArgumentError, and carries stage ingest (not the generic usage token)', () => {
    const error = captureThrown(() => parseCliArgs(['ingest', 'media/p', '--preset', 'hardware']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unexpected-option');
    expect((error as CliUsageError).resource).toBe('--preset');
    expect((error as CliUsageError).stage).toBe('ingest');
  });

  it('step 5: --preset on render is unexpected-option, not a CliArgumentError, and carries stage render (not the generic usage token)', () => {
    const error = captureThrown(() => parseCliArgs(['render', 'media/p', '--preset', 'hardware']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unexpected-option');
    expect((error as CliUsageError).resource).toBe('--preset');
    expect((error as CliUsageError).stage).toBe('render');
  });

  it('step 5: --seed on render is unexpected-option, not a CliArgumentError, and carries stage render', () => {
    const error = captureThrown(() => parseCliArgs(['render', 'media/p', '--seed', '3']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('unexpected-option');
    expect((error as CliUsageError).resource).toBe('--seed');
    expect((error as CliUsageError).stage).toBe('render');
  });

  it('step 6: missing --preset on plan -> CliArgumentError with stage plan', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p']));
    expect(error).toBeInstanceOf(CliArgumentError);
    expect((error as CliArgumentError).reason).toBe('missing-preset');
    expect((error as CliArgumentError).stage).toBe('plan');
  });

  it('step 6 wins over step 8: missing --preset on plan beats an invalid --seed', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--seed', 'nope']));
    expect((error as CliArgumentError).reason).toBe('missing-preset');
  });

  it('step 6: missing --preset on run maps to stage plan (D-27)', () => {
    const error = captureThrown(() => parseCliArgs(['run', 'media/p']));
    expect(error).toBeInstanceOf(CliArgumentError);
    expect((error as CliArgumentError).reason).toBe('missing-preset');
    expect((error as CliArgumentError).stage).toBe('plan');
  });

  it('step 7: an unknown --preset value -> unknown-preset with stage plan', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset', 'bogus']));
    expect(error).toBeInstanceOf(CliArgumentError);
    expect((error as CliArgumentError).reason).toBe('unknown-preset');
    expect((error as CliArgumentError).stage).toBe('plan');
    expect((error as CliArgumentError).resource).toBe('--preset=bogus');
  });

  it('step 7 wins over step 8: an unknown preset beats an invalid seed', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset', 'bogus', '--seed', 'nope']));
    expect((error as CliArgumentError).reason).toBe('unknown-preset');
  });

  it.each(['', ' 1 ', '0x10', '1e3', '-1', '3.5'])('step 8: %j is an invalid seed', (rawSeed) => {
    // `--seed=<value>` avoids node:util parseArgs flagging a leading '-' as another option.
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset', 'hardware', `--seed=${rawSeed}`]));
    expect(error).toBeInstanceOf(CliArgumentError);
    expect((error as CliArgumentError).reason).toBe('invalid-seed');
    expect((error as CliArgumentError).stage).toBe('plan');
  });

  it('step 3: --seed -1 (space-separated) is ambiguous to node:util parseArgs and surfaces as CliUsageError, carrying the recognized command stage', () => {
    const error = captureThrown(() => parseCliArgs(['plan', 'media/p', '--preset', 'hardware', '--seed', '-1']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('invalid-option-value');
    expect((error as CliUsageError).stage).toBe('plan');
  });

  it('run maps missing-project-root to stage ingest, not the generic usage token (D-27)', () => {
    const error = captureThrown(() => parseCliArgs(['run']));
    expect(error).toBeInstanceOf(CliUsageError);
    expect((error as CliUsageError).reason).toBe('missing-project-root');
    expect((error as CliUsageError).stage).toBe('ingest');
  });

  it('step 8: seed 0 is valid', () => {
    expect(parseCliArgs(['plan', 'media/p', '--preset', 'hardware', '--seed', '0'])).toEqual({
      command: 'plan',
      projectRoot: 'media/p',
      options: { preset: 'hardware', seed: 0, scriptPath: null, logo: 'auto', format: 'reels-9x16', voice: 'aroll', pruneSilences: undefined },
    });
  });
});

describe('parseCliArgs — --format (FIX-e-burgos-007-001)', () => {
  it('toma el formato pedido en plan y en run', () => {
    expect(parseCliArgs(['plan', 'media/demo-01', '--preset', 'software-demo', '--format', 'youtube-16x9'])).toEqual({
      command: 'plan',
      projectRoot: 'media/demo-01',
      options: { preset: 'software-demo', seed: 0, scriptPath: null, logo: 'auto', format: 'youtube-16x9', voice: 'aroll', pruneSilences: undefined },
    });
    expect(parseCliArgs(['run', 'media/demo-01', '--preset', 'hardware', '--format', 'tiktok-9x16'])).toEqual({
      command: 'run',
      projectRoot: 'media/demo-01',
      options: { preset: 'hardware', seed: 0, scriptPath: null, logo: 'auto', format: 'tiktok-9x16', voice: 'aroll', pruneSilences: undefined },
    });
  });

  it('sin --format planifica vertical', () => {
    const parsed = parseCliArgs(['plan', 'media/demo-01', '--preset', 'software-demo']);

    expect(parsed.command === 'plan' && parsed.options.format).toBe('reels-9x16');
  });

  it('rechaza un formato desconocido nombrando los cuatro válidos', () => {
    try {
      parseCliArgs(['plan', 'media/demo-01', '--preset', 'software-demo', '--format', '4k']);
      expect.unreachable('parseCliArgs debe rechazar un formato desconocido');
    } catch (error) {
      expect(error).toBeInstanceOf(CliArgumentError);
      expect((error as CliArgumentError).reason).toBe('unknown-format');
      expect((error as CliArgumentError).resource).toBe('--format=4k');
      expect((error as CliArgumentError).expected).toBe(
        'reels-9x16 | tiktok-9x16 | shorts-9x16 | youtube-16x9',
      );
      expect((error as CliArgumentError).stage).toBe('plan');
    }
  });

  it.each(['ingest', 'render'])('%s no acepta --format', (command) => {
    try {
      parseCliArgs([command, 'media/demo-01', '--format', 'youtube-16x9']);
      expect.unreachable('parseCliArgs debe rechazar --format fuera de plan y run');
    } catch (error) {
      expect(error).toBeInstanceOf(CliUsageError);
      expect((error as CliUsageError).reason).toBe('unexpected-option');
      expect((error as CliUsageError).resource).toBe('--format');
    }
  });
});

describe('parseCliArgs — --voice y --prune-silences (FIX-e-burgos-007-002)', () => {
  it('sin --voice la fuente de habla es el A-roll y la poda queda sin decidir', () => {
    const parsed = parseCliArgs(['plan', 'media/demo-01', '--preset', 'software-demo']);

    expect(parsed.command === 'plan' && parsed.options.voice).toBe('aroll');
    expect(parsed.command === 'plan' ? parsed.options.pruneSilences : 'x').toBeUndefined();
  });

  it('toma --voice script y --prune-silences en plan y en run', () => {
    expect(
      parseCliArgs(['plan', 'media/demo-01', '--preset', 'software-demo', '--voice', 'script']),
    ).toEqual({
      command: 'plan',
      projectRoot: 'media/demo-01',
      options: {
        preset: 'software-demo',
        seed: 0,
        scriptPath: null,
        logo: 'auto',
        format: 'reels-9x16',
        voice: 'script',
        pruneSilences: undefined,
      },
    });
    expect(
      parseCliArgs(['run', 'media/demo-01', '--preset=hardware', '--voice=script', '--prune-silences']),
    ).toEqual({
      command: 'run',
      projectRoot: 'media/demo-01',
      options: {
        preset: 'hardware',
        seed: 0,
        scriptPath: null,
        logo: 'auto',
        format: 'reels-9x16',
        voice: 'script',
        pruneSilences: true,
      },
    });
  });

  it('rechaza una fuente de voz desconocida nombrando las dos válidas', () => {
    try {
      parseCliArgs(['plan', 'media/demo-01', '--preset', 'software-demo', '--voice', 'piper']);
      expect.unreachable('parseCliArgs debe rechazar una fuente de voz desconocida');
    } catch (error) {
      expect(error).toBeInstanceOf(CliArgumentError);
      expect((error as CliArgumentError).reason).toBe('unknown-voice-source');
      expect((error as CliArgumentError).resource).toBe('--voice=piper');
      expect((error as CliArgumentError).expected).toBe('aroll | script');
      expect((error as CliArgumentError).stage).toBe('plan');
    }
  });

  it.each(['ingest', 'render'])('%s no acepta --voice ni --prune-silences', (command) => {
    for (const option of ['--voice=script', '--prune-silences']) {
      try {
        parseCliArgs([command, 'media/demo-01', option]);
        expect.unreachable('parseCliArgs debe rechazar la opción fuera de plan y run');
      } catch (error) {
        expect(error).toBeInstanceOf(CliUsageError);
        expect((error as CliUsageError).reason).toBe('unexpected-option');
      }
    }
  });
});

describe('parseCliArgs — --script y --no-logo (spec-014)', () => {
  it('plan acepta --script con la ruta del guion', () => {
    expect(parseCliArgs(['plan', 'media/demo-01', '--preset=hardware', '--script=media/demo-01/work/producer/script.txt'])).toEqual({
      command: 'plan',
      projectRoot: 'media/demo-01',
      options: {
        preset: 'hardware',
        seed: 0,
        scriptPath: 'media/demo-01/work/producer/script.txt',
        logo: 'auto',
        format: 'reels-9x16',
        voice: 'aroll',
        pruneSilences: undefined,
      },
    });
  });

  it('run acepta --script y --no-logo juntos', () => {
    expect(parseCliArgs(['run', 'media/demo-01', '--preset=hardware', '--seed=3', '--script=guion.txt', '--no-logo'])).toEqual({
      command: 'run',
      projectRoot: 'media/demo-01',
      options: { preset: 'hardware', seed: 3, scriptPath: 'guion.txt', logo: 'off', format: 'reels-9x16', voice: 'aroll', pruneSilences: undefined },
    });
  });

  it('sin --no-logo el logo queda en auto', () => {
    const parsed = parseCliArgs(['plan', 'media/demo-01', '--preset=hardware']);

    expect(parsed.command === 'plan' ? parsed.options.logo : null).toBe('auto');
  });

  it('rechaza --script vacío', () => {
    expect(() => parseCliArgs(['plan', 'p', '--preset=hardware', '--script='])).toThrow(CliArgumentError);
  });

  it('ingest y render rechazan --script', () => {
    expect(() => parseCliArgs(['ingest', 'p', '--script=guion.txt'])).toThrow(CliUsageError);
    expect(() => parseCliArgs(['render', 'p', '--script=guion.txt'])).toThrow(CliUsageError);
  });

  it('ingest y render rechazan --no-logo', () => {
    expect(() => parseCliArgs(['ingest', 'p', '--no-logo'])).toThrow(CliUsageError);
    expect(() => parseCliArgs(['render', 'p', '--no-logo'])).toThrow(CliUsageError);
  });
});
