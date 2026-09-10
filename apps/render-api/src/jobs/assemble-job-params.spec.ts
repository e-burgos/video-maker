import { describe, expect, it } from 'vitest';

import {
  parseAssembleJobInput,
  parseAssembleMusicAssetId,
  parseAssembleOverwrite,
  parseScenePaddingMs,
} from './assemble-job-params';

describe('parseAssembleMusicAssetId', () => {
  it('reads a trimmed catalog asset id', () => {
    expect(parseAssembleMusicAssetId('  raw/audio/music01.mp3 ')).toBe('raw/audio/music01.mp3');
  });

  it('treats an absent or null value as no music bed', () => {
    expect(parseAssembleMusicAssetId(undefined)).toBeNull();
    expect(parseAssembleMusicAssetId(null)).toBeNull();
  });

  it('rejects anything that is not a non-empty string', () => {
    expect(() => parseAssembleMusicAssetId('   ')).toThrowError();
    expect(() => parseAssembleMusicAssetId(7)).toThrowError();
  });
});

describe('parseScenePaddingMs', () => {
  it('accepts zero and any positive whole number of milliseconds', () => {
    expect(parseScenePaddingMs(0)).toBe(0);
    expect(parseScenePaddingMs(500)).toBe(500);
  });

  it('treats an absent value as the builder default', () => {
    expect(parseScenePaddingMs(undefined)).toBeNull();
  });

  it('rejects a negative, fractional or non numeric padding', () => {
    expect(() => parseScenePaddingMs(-1)).toThrowError();
    expect(() => parseScenePaddingMs(12.5)).toThrowError();
    expect(() => parseScenePaddingMs('250')).toThrowError();
  });
});

describe('parseAssembleOverwrite', () => {
  it('defaults to not overwriting an existing timeline', () => {
    expect(parseAssembleOverwrite(undefined)).toBe(false);
  });

  it('rejects a non boolean flag', () => {
    expect(() => parseAssembleOverwrite('true')).toThrowError();
  });
});

describe('parseAssembleJobInput', () => {
  it('reads the three fields of the assemble body at once', () => {
    expect(parseAssembleJobInput({ music: 'raw/audio/music01.mp3', scenePaddingMs: 400, overwrite: true })).toEqual({
      musicAssetId: 'raw/audio/music01.mp3',
      scenePaddingMs: 400,
      overwrite: true,
    });
  });

  it('reads an empty body as the defaults of every field', () => {
    expect(parseAssembleJobInput({})).toEqual({
      musicAssetId: null,
      scenePaddingMs: null,
      overwrite: false,
    });
  });
});
