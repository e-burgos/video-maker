import { darken, lighten, mix, rgba } from './color';

export interface BrandPalette {
  background: string;
  accent: string;
  accent2: string;
  text: string;
}

export interface BrandTypography {
  display: string;
  body: string;
  mono?: string | undefined;
}

const LIGHTEN = 0.12;
const LIGHTEN_STRONG = 0.26;
const DARKEN = 0.09;
const BACKGROUND_LIFT = 0.015;
const BACKGROUND_SINK = 0.45;
const WHITE = '#ffffff';
const BLACK = '#000000';

const OK = '#34d399';
const OK_END = '#0d9488';
const BAD = '#f43f5e';
const WARN = '#f59e0b';
const TONE_WARM = 'linear-gradient(160deg, #9a3412 0%, #ea580c 50%, #f59e0b 100%)';

export function deriveBrandTokens(palette: BrandPalette, typography?: BrandTypography): Record<string, string> {
  const { background, accent, accent2, text } = palette;
  const accentLight = lighten(accent, LIGHTEN);
  const accentStrong = lighten(accent, LIGHTEN_STRONG);
  const surface = mix(background, text, 0.06);
  const tokens: Record<string, string> = {
    '--mg-bg': background,
    '--mg-bg-gradient': `radial-gradient(ellipse 120% 90% at 50% 40%, ${mix(background, WHITE, BACKGROUND_LIFT)} 0%, ${background} 55%, ${mix(background, BLACK, BACKGROUND_SINK)} 100%)`,
    '--mg-glow-a': rgba(accent, 0.22),
    '--mg-glow-b': rgba(accent2, 0.16),
    '--mg-glow': `0 10px 80px ${rgba(accent, 0.9)}`,
    '--mg-accent': accent,
    '--mg-accent-2': accentLight,
    '--mg-accent-grad': `linear-gradient(90deg, ${darken(accent, DARKEN)}, ${accentLight})`,
    '--mg-accent-grad-text': `linear-gradient(100deg, ${accentStrong} 0%, ${accentLight} 45%, ${accent2} 100%)`,
    '--mg-accent-soft': rgba(accent, 0.18),
    '--mg-accent-line': rgba(accentLight, 0.45),
    '--mg-accent-shadow': rgba(accent, 0.45),
    '--mg-flash': rgba(accentStrong, 0.95),
    '--mg-text': text,
    '--mg-text-2': mix(text, background, 0.35),
    '--mg-text-3': mix(text, background, 0.55),
    '--mg-surface': surface,
    '--mg-surface-glass': rgba(surface, 0.72),
    '--mg-border': rgba(text, 0.07),
    '--mg-border-strong': rgba(text, 0.14),
    '--mg-radius': '28px',
    '--mg-ok': OK,
    '--mg-ok-grad': `linear-gradient(180deg, ${OK}, ${OK_END})`,
    '--mg-ok-line': rgba(OK, 0.45),
    '--mg-bad': BAD,
    '--mg-bad-line': rgba(BAD, 0.45),
    '--mg-warn': WARN,
    '--mg-warn-line': rgba(WARN, 0.45),
    '--mg-tone-sky': `linear-gradient(160deg, ${darken(accent, DARKEN)} 0%, ${accent} 45%, ${accent2} 100%)`,
    '--mg-tone-teal': `linear-gradient(135deg, ${darken(accent2, DARKEN)} 0%, ${accent2} 50%, ${lighten(accent2, LIGHTEN)} 100%)`,
    '--mg-tone-warm': TONE_WARM,
    '--mg-tone-dark': `linear-gradient(135deg, ${mix(accent, background, 0.75)} 0%, ${mix(background, accent, 0.1)} 60%, ${background} 100%)`,
  };
  return { ...tokens, ...fontTokens(typography) };
}

function fontTokens(typography?: BrandTypography): Record<string, string> {
  if (typography === undefined) {
    return { '--mg-font-display': 'sans-serif', '--mg-font-body': 'sans-serif', '--mg-font-mono': 'ui-monospace, monospace' };
  }
  const { display, body, mono } = typography;
  return {
    '--mg-font-display': `"${display}", "${body}", sans-serif`,
    '--mg-font-body': `"${body}", "${display}", sans-serif`,
    '--mg-font-mono': `"${mono ?? body}", ui-monospace, monospace`,
  };
}

export function tokensToCss(tokens: Readonly<Record<string, string>>): string {
  return `:root {\n${Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')}\n}\n`;
}
