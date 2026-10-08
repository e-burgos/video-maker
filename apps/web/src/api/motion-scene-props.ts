export type MotionPropValue =
  | { kind: 'text'; text: string }
  | { kind: 'image'; file: string }
  | { kind: 'brand'; ref: string };

export type MotionPropEntry = {
  name: string;
  values: MotionPropValue[];
};

const IMAGE_PREFIX = 'images/';
const BRAND_PREFIX = 'brand:';

export const MOTION_IMAGES_DIRECTORY = 'work/motion/images';

export function motionImagePath(file: string): string {
  return `${MOTION_IMAGES_DIRECTORY}/${file}`;
}

function valueOfString(text: string): MotionPropValue | null {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  if (trimmed.startsWith(IMAGE_PREFIX)) {
    return { kind: 'image', file: trimmed.slice(IMAGE_PREFIX.length) };
  }
  if (trimmed.startsWith(BRAND_PREFIX)) {
    return { kind: 'brand', ref: trimmed.slice(BRAND_PREFIX.length) };
  }
  return { kind: 'text', text: trimmed };
}

function valuesOf(raw: unknown): MotionPropValue[] {
  const strings = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
  return strings
    .filter((item): item is string => typeof item === 'string')
    .map(valueOfString)
    .filter((value): value is MotionPropValue => value !== null);
}

export function motionPropEntries(props: Record<string, unknown>): MotionPropEntry[] {
  return Object.entries(props)
    .map(([name, raw]) => ({ name, values: valuesOf(raw) }))
    .filter((entry) => entry.values.length > 0);
}
