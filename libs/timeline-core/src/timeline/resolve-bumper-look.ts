import { createSeededRandom, hashStringToSeed, pickAvoidingPrevious } from '../random/seeded-random';
import type {
  LogoBumper,
  LogoBumperBackground,
  LogoBumperReveal,
  LogoBumperSfxKind,
  TimelineBumpers,
} from '../schemas/timeline.schema';

export type BumperEdge = 'intro' | 'outro';

export interface BumperLook {
  readonly background: LogoBumperBackground;
  readonly reveal: LogoBumperReveal;
  readonly baseColor: string;
  readonly accentColor: string;
  readonly secondaryColor: string;
  readonly caption: string | null;
  readonly sfxKind: LogoBumperSfxKind | null;
}

const SFX_BY_REVEAL: Readonly<Record<LogoBumperReveal, readonly [LogoBumperSfxKind, ...LogoBumperSfxKind[]]>> = {
  wipe: ['whoosh', 'shimmer'],
  'slide-up': ['whoosh', 'impact'],
  pop: ['impact', 'whoosh'],
  zoom: ['impact', 'shimmer'],
  'blur-in': ['shimmer', 'whoosh'],
  fade: ['shimmer', 'whoosh'],
};

function sfxCandidates(reveal: LogoBumperReveal, background: LogoBumperBackground): readonly [LogoBumperSfxKind, ...LogoBumperSfxKind[]] {
  const byReveal = SFX_BY_REVEAL[reveal];
  return background === 'glow' && byReveal[0] !== 'shimmer' ? ['shimmer', ...byReveal.filter((kind) => kind !== 'shimmer')] : byReveal;
}

function explicitSfx(bumper: LogoBumper): LogoBumperSfxKind | null | undefined {
  return bumper.sfxKind === undefined ? undefined : bumper.sfxKind === 'none' ? null : bumper.sfxKind;
}

function rotatedSfx(
  edge: BumperEdge,
  choice: { background: LogoBumperBackground; reveal: LogoBumperReveal },
  bumpers: TimelineBumpers,
  videoKey: string,
): LogoBumperSfxKind {
  const [first, ...rest] = sfxCandidates(choice.reveal, choice.background);
  if (edge === 'intro') {
    return first;
  }
  const introLook = bumpers.intro === undefined ? null : resolveBumperLook(bumpers, 'intro', videoKey);
  const avoided = introLook?.sfxKind ?? null;
  return [first, ...rest].find((kind) => kind !== avoided) ?? first;
}

const DEFAULT_ACCENT_COLOR = '#38bdf8';
const ROTATING_BACKGROUNDS: readonly [LogoBumperBackground, ...LogoBumperBackground[]] = ['gradient', 'noise', 'shapes', 'glow'];
const ROTATING_REVEALS: readonly [LogoBumperReveal, ...LogoBumperReveal[]] = ['zoom', 'slide-up', 'wipe', 'blur-in', 'pop'];
const DEFAULT_SECONDARY_COLOR = '#14b8a6';

function nonEmpty<T>(values: readonly T[] | undefined, fallback: readonly [T, ...T[]]): readonly [T, ...T[]] {
  const [first, ...rest] = values ?? [];
  return first === undefined ? fallback : [first, ...rest];
}

function rotatedChoices(
  bumpers: TimelineBumpers,
  videoKey: string,
): Record<BumperEdge, { background: LogoBumperBackground; reveal: LogoBumperReveal }> {
  const key = bumpers.style?.seed === undefined ? videoKey : String(bumpers.style.seed);
  const next = createSeededRandom(hashStringToSeed(`bumpers:${key}`));
  const backgrounds = nonEmpty(bumpers.style?.backgrounds, ROTATING_BACKGROUNDS);
  const reveals = nonEmpty(bumpers.style?.reveals, ROTATING_REVEALS);
  const introBackground = bumpers.intro?.background ?? pickAvoidingPrevious(backgrounds, undefined, next);
  const introReveal = bumpers.intro?.reveal ?? pickAvoidingPrevious(reveals, undefined, next);
  return {
    intro: { background: introBackground, reveal: introReveal },
    outro: {
      background: bumpers.outro?.background ?? pickAvoidingPrevious(backgrounds, introBackground, next),
      reveal: bumpers.outro?.reveal ?? pickAvoidingPrevious(reveals, introReveal, next),
    },
  };
}

function fixedChoice(bumper: LogoBumper): { background: LogoBumperBackground; reveal: LogoBumperReveal } {
  return { background: bumper.background ?? 'solid', reveal: bumper.reveal ?? bumper.animation };
}

function captionFor(edge: BumperEdge, bumper: LogoBumper, bumpers: TimelineBumpers): string | null {
  return bumper.caption ?? (edge === 'outro' ? (bumpers.style?.outroCaption ?? null) : null);
}

export function resolveBumperLook(bumpers: TimelineBumpers, edge: BumperEdge, videoKey: string): BumperLook | null {
  const bumper = bumpers[edge];
  if (bumper === undefined) {
    return null;
  }
  const rotating = bumpers.style?.rotate === true;
  const choice = rotating ? rotatedChoices(bumpers, videoKey)[edge] : fixedChoice(bumper);
  const explicit = explicitSfx(bumper);
  const sfxKind = explicit !== undefined ? explicit : rotating ? rotatedSfx(edge, choice, bumpers, videoKey) : null;
  return {
    ...choice,
    sfxKind,
    baseColor: bumper.backgroundColor,
    accentColor: bumper.accentColor ?? bumpers.style?.accentColor ?? DEFAULT_ACCENT_COLOR,
    secondaryColor: bumpers.style?.secondaryColor ?? DEFAULT_SECONDARY_COLOR,
    caption: captionFor(edge, bumper, bumpers),
  };
}
