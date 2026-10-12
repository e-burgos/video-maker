import { z } from 'zod';

export const REFERENCE_BRIEF_VERSION = 1;
export const REFERENCE_ORIENTATIONS = ['landscape', 'portrait', 'square'] as const;

const SecondsSchema = z.number().min(0);

export const ReferenceFormatSchema = z.strictObject({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  orientation: z.enum(REFERENCE_ORIENTATIONS),
});

export const ReferenceSceneSchema = z.strictObject({
  index: z.number().int().min(0),
  startSec: SecondsSchema,
  endSec: SecondsSchema,
  durationSec: SecondsSchema,
  keyframe: z.string().min(1),
});

export const ReferencePaceSchema = z.strictObject({
  cutsPerMinute: SecondsSchema,
  meanSceneSec: SecondsSchema,
  medianSceneSec: SecondsSchema,
});

export const ReferencePhraseSchema = z.strictObject({
  startSec: SecondsSchema,
  endSec: SecondsSchema,
  text: z.string().min(1),
});

export const ReferenceVoiceSchema = z.strictObject({
  transcript: z.array(ReferencePhraseSchema),
  wordsPerMinute: SecondsSchema,
  speechRatio: z.number().min(0).max(1),
});

export const ReferenceAudioSchema = z.strictObject({
  integratedLufs: z.number().nullable(),
  longSilences: z.array(z.strictObject({ startSec: SecondsSchema, endSec: SecondsSchema })),
});

export const ReferenceBriefSchema = z.strictObject({
  version: z.literal(REFERENCE_BRIEF_VERSION),
  file: z.string().min(1),
  durationSec: z.number().positive(),
  format: ReferenceFormatSchema,
  scenes: z.array(ReferenceSceneSchema).min(1),
  pace: ReferencePaceSchema,
  voice: ReferenceVoiceSchema.nullable(),
  audio: ReferenceAudioSchema,
  summary: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type ReferenceFormat = z.infer<typeof ReferenceFormatSchema>;
export type ReferenceScene = z.infer<typeof ReferenceSceneSchema>;
export type ReferencePace = z.infer<typeof ReferencePaceSchema>;
export type ReferencePhrase = z.infer<typeof ReferencePhraseSchema>;
export type ReferenceVoice = z.infer<typeof ReferenceVoiceSchema>;
export type ReferenceAudio = z.infer<typeof ReferenceAudioSchema>;
export type ReferenceBrief = z.infer<typeof ReferenceBriefSchema>;
export type ReferenceBriefFacts = Omit<ReferenceBrief, 'summary' | 'createdAt' | 'version'>;

export function orientationFor(width: number, height: number): ReferenceFormat['orientation'] {
  if (width === height) {
    return 'square';
  }
  return width > height ? 'landscape' : 'portrait';
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? upper) + upper) / 2;
}

export function paceFromScenes(
  scenes: readonly Pick<ReferenceScene, 'durationSec'>[],
  durationSec: number,
): ReferencePace {
  const durations = scenes.map((scene) => scene.durationSec);
  const cuts = Math.max(scenes.length - 1, 0);
  return {
    cutsPerMinute: roundTo((cuts / durationSec) * 60, 1),
    meanSceneSec: roundTo(durationSec / Math.max(scenes.length, 1), 2),
    medianSceneSec: roundTo(medianOf(durations), 2),
  };
}

export function wordsPerMinuteFor(wordCount: number, durationSec: number): number {
  return roundTo((wordCount / durationSec) * 60, 0);
}

const ORIENTATION_LABEL: Readonly<Record<ReferenceFormat['orientation'], string>> = {
  landscape: 'horizontal',
  portrait: 'vertical',
  square: 'cuadrado',
};

function formatDuration(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.round(durationSec % 60);
  return minutes === 0 ? `${seconds} s` : `${minutes} min ${seconds} s`;
}

function paceSentence(brief: ReferenceBriefFacts): string {
  const { pace, scenes } = brief;
  const sceneWord = scenes.length === 1 ? 'escena' : 'escenas';
  return `${scenes.length} ${sceneWord}, ${pace.cutsPerMinute} cortes por minuto, escena media de ${pace.meanSceneSec} s (mediana ${pace.medianSceneSec} s).`;
}

function voiceSentence(voice: ReferenceVoice | null): string {
  if (voice === null) {
    return 'Sin voz hablada detectada.';
  }
  const speechPercent = Math.round(voice.speechRatio * 100);
  return `Voz de ${voice.wordsPerMinute} palabras por minuto, con habla en el ${speechPercent}% del video.`;
}

function silenceLabel(count: number): string {
  if (count === 0) {
    return 'sin silencios largos';
  }
  return count === 1 ? '1 silencio largo' : `${count} silencios largos`;
}

function audioSentence(audio: ReferenceAudio): string {
  const loudness = audio.integratedLufs === null ? 'sin sonoridad medible' : `sonoridad ${audio.integratedLufs} LUFS`;
  const silences = silenceLabel(audio.longSilences.length);
  return `Audio: ${loudness}, ${silences}.`;
}

export function buildReferenceSummary(brief: ReferenceBriefFacts): string {
  const { format } = brief;
  const header = `Referencia de ${formatDuration(brief.durationSec)}, ${ORIENTATION_LABEL[format.orientation]} ${format.width}x${format.height} a ${format.fps} fps.`;
  return [header, paceSentence(brief), voiceSentence(brief.voice), audioSentence(brief.audio)].join(' ');
}
