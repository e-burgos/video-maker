import type { FindingDraft } from './review-finding-builder';
import type { SfxEvent } from './review-inputs';
import {
  SFX_DENSITY_WINDOW_SEC,
  SFX_MAX_EVENTS_IN_WINDOW,
  SFX_MAX_EVENTS_PER_MINUTE,
  SFX_MAX_SAME_IN_A_ROW,
} from './review-thresholds';

const REPETITION_CHECK = 'sfx-repetition';
const DENSITY_CHECK = 'sfx-density';
const SECONDS_PER_MINUTE = 60;

interface SoundRun {
  readonly sound: string;
  readonly events: readonly SfxEvent[];
}

function inTimeOrder(events: readonly SfxEvent[]): SfxEvent[] {
  return [...events].sort((left, right) => left.startSec - right.startSec);
}

function soundRuns(events: readonly SfxEvent[]): SoundRun[] {
  const runs: { sound: string; events: SfxEvent[] }[] = [];
  for (const event of inTimeOrder(events)) {
    const last = runs.at(-1);
    if (last?.sound === event.sound) {
      last.events.push(event);
    } else {
      runs.push({ sound: event.sound, events: [event] });
    }
  }
  return runs;
}

function repetitionFinding(run: SoundRun): FindingDraft {
  const first = run.events[0]?.startSec ?? 0;
  const last = run.events.at(-1)?.startSec ?? first;
  return {
    check: REPETITION_CHECK,
    severity: 'suggestion',
    message: `Suena el mismo efecto «${run.sound}» ${String(run.events.length)} veces seguidas: el oído lo registra como una ametralladora.`,
    timeRange: { startSec: first, endSec: last },
    proposedFix: `Alternar variantes del mismo tipo de efecto (el banco tiene varias por tipo) o dejar en silencio algunos cortes: nunca más de ${String(SFX_MAX_SAME_IN_A_ROW - 1)} iguales seguidos.`,
  };
}

export function sfxRepetitionFindings(events: readonly SfxEvent[]): FindingDraft[] {
  return soundRuns(events)
    .filter((run) => run.events.length >= SFX_MAX_SAME_IN_A_ROW)
    .map(repetitionFinding);
}

function busiestWindow(events: readonly SfxEvent[]): { readonly startSec: number; readonly count: number } {
  const ordered = inTimeOrder(events);
  return ordered.reduce(
    (best, event) => {
      const count = ordered.filter((other) => other.startSec >= event.startSec && other.startSec < event.startSec + SFX_DENSITY_WINDOW_SEC).length;
      return count > best.count ? { startSec: event.startSec, count } : best;
    },
    { startSec: 0, count: 0 },
  );
}

export function sfxDensityFindings(events: readonly SfxEvent[], durationSec: number): FindingDraft[] {
  const findings: FindingDraft[] = [];
  const window = busiestWindow(events);
  if (window.count > SFX_MAX_EVENTS_IN_WINDOW) {
    findings.push({
      check: DENSITY_CHECK,
      severity: 'suggestion',
      message: `Hay ${String(window.count)} efectos de sonido en ${String(SFX_DENSITY_WINDOW_SEC)} s: se pisan entre sí y le quitan peso a cada uno.`,
      timeRange: { startSec: window.startSec, endSec: window.startSec + SFX_DENSITY_WINDOW_SEC },
      proposedFix: `Dejar a lo sumo ${String(SFX_MAX_EVENTS_IN_WINDOW)} efectos en ${String(SFX_DENSITY_WINDOW_SEC)} s y reservar los golpes para los momentos grandes.`,
    });
  }
  const perMinute = durationSec > 0 ? (events.length * SECONDS_PER_MINUTE) / durationSec : 0;
  if (perMinute > SFX_MAX_EVENTS_PER_MINUTE) {
    findings.push({
      check: DENSITY_CHECK,
      severity: 'suggestion',
      message: `El video tiene ${perMinute.toFixed(0)} efectos de sonido por minuto: con tantos, ninguno se destaca.`,
      proposedFix: `Bajar a ${String(SFX_MAX_EVENTS_PER_MINUTE)} por minuto o menos, sonorizando solo los cortes y momentos que importan.`,
    });
  }
  return findings;
}
