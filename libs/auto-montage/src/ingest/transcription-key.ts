import type { TranscriptionEngine } from '@video-maker/timeline-core';

export interface TranscriptionKeyInput {
  readonly assetId: string;
  readonly sizeBytes: number;
  readonly modifiedAtMs: number;
  readonly engine: TranscriptionEngine;
  readonly model: string;
  readonly language: string;
}

export function buildTranscriptionKey(input: TranscriptionKeyInput): string {
  return [
    input.assetId,
    input.sizeBytes,
    input.modifiedAtMs,
    input.engine,
    input.model,
    input.language,
  ].join('|');
}
