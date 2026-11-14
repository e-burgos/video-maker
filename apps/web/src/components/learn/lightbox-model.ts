export type LightboxImage = {
  src: string;
  caption: string;
};

export function stepLightboxIndex(count: number, index: number, direction: -1 | 1): number {
  return count === 0 ? 0 : (index + direction + count) % count;
}
