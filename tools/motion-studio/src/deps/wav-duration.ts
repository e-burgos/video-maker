import { MotionStudioError } from '../errors/motion-studio-error';

export function wavDurationSec(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.byteLength < 12 || ascii(0) !== 'RIFF' || ascii(8) !== 'WAVE') {
    throw new MotionStudioError('STAGE_FAILED', 'voice file is not a RIFF/WAVE file');
  }
  let byteRate = 0;
  for (let offset = 12; offset + 8 <= bytes.byteLength; ) {
    const id = ascii(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') byteRate = view.getUint32(offset + 16, true);
    if (id === 'data') {
      if (byteRate === 0) break;
      return Math.round((size / byteRate) * 1000) / 1000;
    }
    offset += 8 + size + (size % 2);
  }
  throw new MotionStudioError('STAGE_FAILED', 'voice file has no fmt/data chunks');
}
