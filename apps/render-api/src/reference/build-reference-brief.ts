import {
  REFERENCE_BRIEF_VERSION,
  ReferenceBriefSchema,
  buildReferenceSummary,
  orientationFor,
  paceFromScenes,
  wordsPerMinuteFor,
} from '@video-maker/timeline-core';
import type {
  ReferenceBrief,
  ReferenceBriefFacts,
  ReferencePhrase,
  ReferenceVoice,
  Transcription,
  Word,
} from '@video-maker/timeline-core';
import type { VideoScene } from '@video-maker/media-local';

import type { ReferenceProbe, ReferenceSilence } from './reference-measurements';
import { referenceKeyframePath } from './reference-paths';

const MILLISECONDS_PER_SECOND = 1000;
const MAX_WORD_SPEECH_MS = 800;
const PHRASE_GAP_MS = 700;
const SENTENCE_END_PATTERN = /[.!?…]$/u;

export interface ReferenceBriefInputs {
  readonly file: string;
  readonly name: string;
  readonly probe: ReferenceProbe;
  readonly scenes: readonly VideoScene[];
  readonly transcription: Transcription | null;
  readonly integratedLufs: number | null;
  readonly longSilences: readonly ReferenceSilence[];
  readonly createdAt: string;
}

function toSeconds(milliseconds: number): number {
  return Math.max(0, Math.round(milliseconds) / MILLISECONDS_PER_SECOND);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function speechRatioOf(transcription: Transcription, durationSec: number): number {
  const speechMs = transcription.words.reduce(
    (total, word) => total + Math.min(word.endMs - word.startMs, MAX_WORD_SPEECH_MS),
    0,
  );
  return roundTo(Math.min(speechMs / MILLISECONDS_PER_SECOND / durationSec, 1), 2);
}

function endsSentence(text: string): boolean {
  return SENTENCE_END_PATTERN.test(text.trim());
}

function groupWordsIntoPhrases(words: readonly Word[]): Word[][] {
  const phrases: Word[][] = [];
  let current: Word[] = [];
  for (const [index, word] of words.entries()) {
    const previous = words[index - 1];
    const startsAfterPause = previous !== undefined && word.startMs - previous.endMs >= PHRASE_GAP_MS;
    if (current.length > 0 && (startsAfterPause || endsSentence(previous?.text ?? ''))) {
      phrases.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length > 0) {
    phrases.push(current);
  }
  return phrases;
}

function spokenEndMs(word: Word): number {
  return word.startMs + Math.min(word.endMs - word.startMs, MAX_WORD_SPEECH_MS);
}

function insideSilence(second: number, silences: readonly ReferenceSilence[]): ReferenceSilence | undefined {
  return silences.find((silence) => second >= silence.startSec && second < silence.endSec);
}

function trimToSpeech(phrase: ReferencePhrase, silences: readonly ReferenceSilence[]): ReferencePhrase {
  const startSec = insideSilence(phrase.startSec, silences)?.endSec ?? phrase.startSec;
  const endSec = insideSilence(phrase.endSec, silences)?.startSec ?? phrase.endSec;
  return endSec > startSec ? { ...phrase, startSec, endSec } : phrase;
}

function phraseFrom(words: readonly Word[]): ReferencePhrase {
  const first = words[0];
  const last = words[words.length - 1];
  return {
    startSec: toSeconds(first?.startMs ?? 0),
    endSec: toSeconds(last === undefined ? 0 : spokenEndMs(last)),
    text: words.map((word) => word.text.trim()).join(' ').replace(/\s+([,.;:!?])/gu, '$1'),
  };
}

function voiceFrom(
  transcription: Transcription | null,
  durationSec: number,
  silences: readonly ReferenceSilence[],
): ReferenceVoice | null {
  if (transcription === null || transcription.words.length === 0) {
    return null;
  }
  return {
    transcript: groupWordsIntoPhrases(transcription.words)
      .map(phraseFrom)
      .filter((phrase) => phrase.text.length > 0)
      .map((phrase) => trimToSpeech(phrase, silences)),
    wordsPerMinute: wordsPerMinuteFor(transcription.words.length, durationSec),
    speechRatio: speechRatioOf(transcription, durationSec),
  };
}

export function buildReferenceBrief(inputs: ReferenceBriefInputs): ReferenceBrief {
  const { probe, scenes, name } = inputs;
  const briefScenes = scenes.map((scene) => ({
    index: scene.index,
    startSec: scene.startSec,
    endSec: scene.endSec,
    durationSec: scene.durationSec,
    keyframe: referenceKeyframePath(name, scene.index),
  }));
  const facts: ReferenceBriefFacts = {
    file: inputs.file,
    durationSec: roundTo(probe.durationSec, 3),
    format: {
      width: probe.width,
      height: probe.height,
      fps: roundTo(probe.fps, 2),
      orientation: orientationFor(probe.width, probe.height),
    },
    scenes: briefScenes,
    pace: paceFromScenes(briefScenes, probe.durationSec),
    voice: voiceFrom(inputs.transcription, probe.durationSec, inputs.longSilences),
    audio: {
      integratedLufs: inputs.integratedLufs === null ? null : roundTo(inputs.integratedLufs, 1),
      longSilences: inputs.longSilences.map((silence) => ({ startSec: silence.startSec, endSec: silence.endSec })),
    },
  };
  return ReferenceBriefSchema.parse({
    version: REFERENCE_BRIEF_VERSION,
    ...facts,
    summary: buildReferenceSummary(facts),
    createdAt: inputs.createdAt,
  });
}
