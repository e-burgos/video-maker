import { intelligibilityScore } from './intelligibility-score';

export interface HeardWord {
  text: string;
  start: number;
  end: number;
}

export interface TakeTranscript {
  text: string;
  words: HeardWord[];
}

export interface TakeAttempt {
  take: number;
  path: string;
  durationSec: number;
  score: number;
  transcript: TakeTranscript;
}

export interface BestTakePorts {
  synthesizeTake: (take: number) => Promise<{ path: string; durationSec: number }>;
  transcribeTake: (path: string) => Promise<TakeTranscript>;
}

export interface BestTakeOptions {
  takes: number;
  goodEnough?: number;
}

export async function pickBestTake(expected: string, ports: BestTakePorts, opts: BestTakeOptions): Promise<{ best: TakeAttempt; attempts: TakeAttempt[] }> {
  const goodEnough = opts.goodEnough ?? 0.97;
  const attempts: TakeAttempt[] = [];
  for (let take = 0; take < Math.max(1, opts.takes); take++) {
    const { path, durationSec } = await ports.synthesizeTake(take);
    const transcript = await ports.transcribeTake(path);
    const score = intelligibilityScore(expected, transcript.text);
    attempts.push({ take, path, durationSec, transcript, score });
    if (score >= goodEnough) break;
  }
  const [first, ...rest] = attempts as [TakeAttempt, ...TakeAttempt[]];
  const best = rest.reduce((winner, attempt) => (attempt.score > winner.score ? attempt : winner), first);
  return { best, attempts };
}
