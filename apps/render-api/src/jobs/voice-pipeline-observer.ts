import type { VoiceStage } from './render-job';

export interface VoicePipelineObserver {
  readonly stageStarted: (stage: VoiceStage) => void;
  readonly sceneProcessed: (stage: VoiceStage, processedScenes: number, totalScenes: number) => void;
  readonly cancellationRequested: () => boolean;
}

export class VoicePipelineCanceledError extends Error {
  readonly stage: VoiceStage;

  constructor(stage: VoiceStage) {
    super(`Voice pipeline canceled before the ${stage} stage.`);
    this.name = 'VoicePipelineCanceledError';
    this.stage = stage;
  }
}

export function isVoicePipelineCanceled(value: unknown): value is VoicePipelineCanceledError {
  return value instanceof VoicePipelineCanceledError;
}

export function voiceCheckpoint(observer: VoicePipelineObserver | undefined, stage: VoiceStage): void {
  if (observer?.cancellationRequested() === true) {
    throw new VoicePipelineCanceledError(stage);
  }
}
