import { describe, expect, it } from 'vitest';

import {
  parseMontageFormat,
  parseMontageVoice,
  parseMontageLogo,
  parseMontageOverwrite,
  parseMontagePreset,
  parseMontageScript,
  parseMontageSeed,
} from './montage-job-params';
import { PipelineStageError } from '../errors/pipeline-stage-error';

function captureError(run: () => unknown): unknown {
  try {
    run();
    return null;
  } catch (error) {
    return error;
  }
}

describe('parseMontagePreset', () => {
  it('defaults to software-demo when the value is absent', () => {
    expect(parseMontagePreset(undefined)).toBe('software-demo');
  });

  it('passes through each known preset name unchanged', () => {
    expect(parseMontagePreset('software-demo')).toBe('software-demo');
    expect(parseMontagePreset('hardware')).toBe('hardware');
    expect(parseMontagePreset('recipe')).toBe('recipe');
    expect(parseMontagePreset('educational')).toBe('educational');
  });

  it('rejects an unknown preset name with MONTAGE_PRESET_INVALID and the list of valid presets', () => {
    const error = captureError(() => parseMontagePreset('nope'));

    expect(error).toMatchObject({ code: 'MONTAGE_PRESET_INVALID', stage: null });
    expect((error as { expected: string }).expected).toContain('software-demo');
    expect((error as { expected: string }).expected).toContain('hardware');
    expect((error as { expected: string }).expected).toContain('recipe');
    expect((error as { expected: string }).expected).toContain('educational');
  });

  it('rejects a non-string preset value', () => {
    expect(captureError(() => parseMontagePreset(42))).toMatchObject({ code: 'MONTAGE_PRESET_INVALID' });
    expect(captureError(() => parseMontagePreset(null))).toMatchObject({ code: 'MONTAGE_PRESET_INVALID' });
  });
});

describe('parseMontageSeed', () => {
  it('defaults to 0 when the value is absent', () => {
    expect(parseMontageSeed(undefined)).toBe(0);
  });

  it('passes through a non-zero non-negative integer unchanged', () => {
    expect(parseMontageSeed(7)).toBe(7);
  });

  it('rejects a negative integer', () => {
    expect(captureError(() => parseMontageSeed(-1))).toMatchObject({
      code: 'MONTAGE_SEED_INVALID',
      stage: null,
    });
  });

  it('rejects a non-integer number', () => {
    expect(captureError(() => parseMontageSeed(1.5))).toMatchObject({ code: 'MONTAGE_SEED_INVALID' });
  });

  it('rejects a numeric string', () => {
    expect(captureError(() => parseMontageSeed('0'))).toMatchObject({ code: 'MONTAGE_SEED_INVALID' });
  });

  it('rejects NaN', () => {
    expect(captureError(() => parseMontageSeed(Number.NaN))).toMatchObject({ code: 'MONTAGE_SEED_INVALID' });
  });

  it('rejects Infinity', () => {
    expect(captureError(() => parseMontageSeed(Number.POSITIVE_INFINITY))).toMatchObject({
      code: 'MONTAGE_SEED_INVALID',
    });
  });
});

describe('parseMontageOverwrite', () => {
  it('defaults to false when the value is absent', () => {
    expect(parseMontageOverwrite(undefined)).toBe(false);
  });

  it('passes through true unchanged', () => {
    expect(parseMontageOverwrite(true)).toBe(true);
  });

  it('passes through false unchanged', () => {
    expect(parseMontageOverwrite(false)).toBe(false);
  });

  it('rejects the string "yes"', () => {
    expect(captureError(() => parseMontageOverwrite('yes'))).toMatchObject({
      code: 'MONTAGE_OVERWRITE_INVALID',
      stage: null,
    });
  });

  it('rejects the string "true"', () => {
    expect(captureError(() => parseMontageOverwrite('true'))).toMatchObject({
      code: 'MONTAGE_OVERWRITE_INVALID',
    });
  });

  it('rejects the number 1', () => {
    expect(captureError(() => parseMontageOverwrite(1))).toMatchObject({ code: 'MONTAGE_OVERWRITE_INVALID' });
  });

  it('rejects null', () => {
    expect(captureError(() => parseMontageOverwrite(null))).toMatchObject({ code: 'MONTAGE_OVERWRITE_INVALID' });
  });
});

describe('parseMontageScript', () => {
  it('defaults both to null when neither is sent', () => {
    expect(parseMontageScript(undefined, undefined)).toEqual({ scriptPath: null, scriptText: null });
  });

  it('accepts a project-relative path', () => {
    expect(parseMontageScript('work/producer/script.txt', undefined)).toEqual({
      scriptPath: 'work/producer/script.txt',
      scriptText: null,
    });
  });

  it('accepts the script inline', () => {
    expect(parseMontageScript(undefined, 'hola mundo')).toEqual({
      scriptPath: null,
      scriptText: 'hola mundo',
    });
  });

  it('rejects sending both', () => {
    const error = captureError(() => parseMontageScript('a.txt', 'hola'));

    expect(error).toBeInstanceOf(PipelineStageError);
    expect((error as PipelineStageError).code).toBe('MONTAGE_SCRIPT_INVALID');
  });

  it('rejects an empty or non-string scriptPath', () => {
    expect((captureError(() => parseMontageScript('   ', undefined)) as PipelineStageError).code).toBe(
      'MONTAGE_SCRIPT_INVALID',
    );
    expect((captureError(() => parseMontageScript(7, undefined)) as PipelineStageError).code).toBe(
      'MONTAGE_SCRIPT_INVALID',
    );
  });

  it('rejects an empty scriptText', () => {
    expect((captureError(() => parseMontageScript(undefined, '')) as PipelineStageError).code).toBe(
      'MONTAGE_SCRIPT_INVALID',
    );
  });
});

describe('parseMontageLogo', () => {
  it('defaults to auto', () => {
    expect(parseMontageLogo(undefined)).toBe('auto');
  });

  it('accepts auto and off', () => {
    expect(parseMontageLogo('auto')).toBe('auto');
    expect(parseMontageLogo('off')).toBe('off');
  });

  it('rejects anything else with MONTAGE_LOGO_INVALID', () => {
    const error = captureError(() => parseMontageLogo('maybe'));

    expect(error).toBeInstanceOf(PipelineStageError);
    expect((error as PipelineStageError).code).toBe('MONTAGE_LOGO_INVALID');
  });
});

describe('parseMontageFormat', () => {
  it('defaults to reels-9x16', () => {
    expect(parseMontageFormat(undefined)).toBe('reels-9x16');
  });

  it.each(['reels-9x16', 'tiktok-9x16', 'shorts-9x16', 'youtube-16x9'])('accepts %s', (preset) => {
    expect(parseMontageFormat(preset)).toBe(preset);
  });

  it('rejects anything else with MONTAGE_FORMAT_INVALID naming the four presets', () => {
    const error = captureError(() => parseMontageFormat('4k'));

    expect(error).toBeInstanceOf(PipelineStageError);
    expect((error as PipelineStageError).code).toBe('MONTAGE_FORMAT_INVALID');
    expect((error as PipelineStageError).expected).toBe(
      'one of reels-9x16, tiktok-9x16, shorts-9x16, youtube-16x9',
    );
  });
});

describe('parseMontageVoice (FIX-e-burgos-007-002)', () => {
  it('defaults to aroll', () => {
    expect(parseMontageVoice(undefined)).toBe('aroll');
  });

  it.each(['aroll', 'script'])('accepts %s', (source) => {
    expect(parseMontageVoice(source)).toBe(source);
  });

  it('rejects anything else with MONTAGE_VOICE_INVALID naming both sources', () => {
    const error = captureError(() => parseMontageVoice('piper'));

    expect(error).toBeInstanceOf(PipelineStageError);
    expect((error as PipelineStageError).code).toBe('MONTAGE_VOICE_INVALID');
    expect((error as PipelineStageError).resource).toBe('voice');
    expect((error as PipelineStageError).expected).toBe('one of aroll, script');
  });

  it('rejects a non-string with MONTAGE_VOICE_INVALID', () => {
    expect(captureError(() => parseMontageVoice(1))).toBeInstanceOf(PipelineStageError);
  });
});
