import { splitVoiceScriptLines } from '../schemas/voice-script-manifest.schema';
import type { Ms } from '../types/units';

export interface ParsedVoiceScriptLine {
  readonly text: string;
  readonly requestedStartMs: Ms | null;
  readonly requestedEndMs: Ms | null;
}

const TIME_MARK_PATTERN =
  /^\[\s*(\d{1,3}):([0-5]\d)\s*(?:[-–—]\s*(\d{1,3}):([0-5]\d)\s*)?\]\s*(\S.*)$/u;

function toMs(minutes: string, seconds: string): Ms {
  return Number(minutes) * 60_000 + Number(seconds) * 1000;
}

function parseLine(line: string): ParsedVoiceScriptLine {
  const match = TIME_MARK_PATTERN.exec(line);
  if (match === null) {
    return { text: line, requestedStartMs: null, requestedEndMs: null };
  }

  const [, startMinutes, startSeconds, endMinutes, endSeconds, text] = match;
  const requestedStartMs = toMs(startMinutes as string, startSeconds as string);
  const requestedEndMs =
    endMinutes === undefined || endSeconds === undefined ? null : toMs(endMinutes, endSeconds);

  return {
    text: text as string,
    requestedStartMs,
    requestedEndMs: requestedEndMs !== null && requestedEndMs > requestedStartMs ? requestedEndMs : null,
  };
}

export function parseVoiceScriptLines(scriptText: string): readonly ParsedVoiceScriptLine[] {
  return splitVoiceScriptLines(scriptText).map(parseLine);
}

export function hasVoiceScriptTimeMarks(lines: readonly ParsedVoiceScriptLine[]): boolean {
  return lines.some((line) => line.requestedStartMs !== null);
}

export function stripVoiceScriptTimeMarks(scriptText: string): string {
  return parseVoiceScriptLines(scriptText)
    .map((line) => line.text)
    .join('\n');
}
