import type { MediaProject } from '@video-maker/auto-montage';
import type { Transcription, VoiceScriptWordsSource, Word } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { alignScriptTextToWords } from './align-script-text-to-words';
import { whisperLanguageFor } from './voice-language';
import { transcribeVoiceTrackDocument } from './voice-synthesis-steps';

export interface VoiceScriptLineWindow {
  readonly lineId: string;
  readonly text: string;
  readonly path: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface VoiceScriptLineWords {
  readonly words: readonly Word[];
  readonly source: VoiceScriptWordsSource;
  readonly transcription: Transcription | null;
}

function clampWordsToWindow(
  words: readonly Word[],
  window: VoiceScriptLineWindow,
): readonly Word[] {
  const clamped: Word[] = [];
  let cursorMs = window.startMs;

  for (const word of words) {
    const startMs = Math.min(Math.max(window.startMs + word.startMs, cursorMs), window.endMs);
    const endMs = Math.min(Math.max(window.startMs + word.endMs, startMs), window.endMs);
    if (endMs <= startMs) {
      continue;
    }
    clamped.push({ ...word, startMs, endMs });
    cursorMs = endMs;
  }

  return clamped;
}

function spreadScriptTextOverWindow(window: VoiceScriptLineWindow): readonly Word[] {
  const tokens = window.text.split(/\s+/u).filter((token) => token !== '');
  const spanMs = Math.max(0, window.endMs - window.startMs);

  return tokens.map((token, index) => ({
    text: token,
    startMs: window.startMs + Math.round((spanMs * index) / tokens.length),
    endMs: window.startMs + Math.round((spanMs * (index + 1)) / tokens.length),
  }));
}

async function transcribeWindow(
  window: VoiceScriptLineWindow,
  language: string,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<Transcription | null> {
  try {
    return await transcribeVoiceTrackDocument(
      window.lineId,
      window.path,
      language,
      deps,
      project,
    );
  } catch {
    return null;
  }
}

export async function transcribeVoiceScriptLine(
  window: VoiceScriptLineWindow,
  language: string,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<VoiceScriptLineWords> {
  const transcription = await transcribeWindow(window, language, deps, project);
  const heard = transcription === null ? [] : clampWordsToWindow(transcription.words, window);

  if (heard.length > 0) {
    return { words: alignScriptTextToWords(window.text, heard), source: 'whisper', transcription };
  }

  return { words: spreadScriptTextOverWindow(window), source: 'script', transcription };
}

export function mergeVoiceScriptLineWords(
  assetId: string,
  language: string,
  lines: readonly VoiceScriptLineWords[],
): Transcription {
  const sample = lines.find((line) => line.transcription !== null)?.transcription ?? null;
  const model = sample?.model;

  return {
    assetId,
    engine: sample?.engine ?? 'whisper.cpp',
    ...(model === undefined ? {} : { model }),
    language: sample?.language ?? whisperLanguageFor(language),
    words: lines.flatMap((line) => [...line.words]),
    segments: [],
  };
}
