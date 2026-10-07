import { describe, expect, it } from 'vitest';

import { wavDurationSec } from './wav-duration';

function wav(seconds: number, extraChunk = false): Uint8Array {
  const sampleRate = 22050;
  const dataSize = Math.round(seconds * sampleRate) * 2;
  const extra = extraChunk ? 8 + 3 + 1 : 0;
  const bytes = new Uint8Array(44 + extra + dataSize);
  const view = new DataView(bytes.buffer);
  const put = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  put(0, 'RIFF');
  view.setUint32(4, 36 + extra + dataSize, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  let offset = 36;
  if (extraChunk) {
    put(offset, 'LIST');
    view.setUint32(offset + 4, 3, true);
    offset += 12;
  }
  put(offset, 'data');
  view.setUint32(offset + 4, dataSize, true);
  return bytes;
}

describe('wavDurationSec', () => {
  it('reads the duration from the fmt and data chunks', () => {
    expect(wavDurationSec(wav(4.72))).toBe(4.72);
  });

  it('skips unknown chunks with odd sizes', () => {
    expect(wavDurationSec(wav(1.5, true))).toBe(1.5);
  });

  it('rejects a file that is not WAVE', () => {
    expect(() => wavDurationSec(new TextEncoder().encode('ID3 not a wave file'))).toThrow('RIFF/WAVE');
  });

  it('rejects a WAVE without data', () => {
    expect(() => wavDurationSec(wav(1).subarray(0, 36))).toThrow('no fmt/data');
  });
});
