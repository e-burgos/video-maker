export type Rgb = readonly [number, number, number];

const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function parseHex(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

export function mix(from: string, to: string, towards: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  return toHex([0, 1, 2].map((i) => (a[i] ?? 0) * (1 - towards) + (b[i] ?? 0) * towards) as unknown as Rgb);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === rn ? (gn - bn) / delta + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / delta + 2 : (rn - gn) / delta + 4;
  return [hue / 6, saturation, lightness];
}

function hueToChannel(p: number, q: number, t: number): number {
  const wrapped = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (wrapped < 1 / 6) return p + (q - p) * 6 * wrapped;
  if (wrapped < 1 / 2) return q;
  if (wrapped < 2 / 3) return p + (q - p) * (2 / 3 - wrapped) * 6;
  return p;
}

function fromHsl([hue, saturation, lightness]: [number, number, number]): string {
  if (saturation === 0) return toHex([lightness * 255, lightness * 255, lightness * 255]);
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return toHex([hueToChannel(p, q, hue + 1 / 3) * 255, hueToChannel(p, q, hue) * 255, hueToChannel(p, q, hue - 1 / 3) * 255]);
}

export function lighten(hex: string, amount: number): string {
  const [hue, saturation, lightness] = toHsl(parseHex(hex));
  return fromHsl([hue, saturation, clamp(lightness + amount, 0, 1)]);
}

export function darken(hex: string, amount: number): string {
  return lighten(hex, -amount);
}
