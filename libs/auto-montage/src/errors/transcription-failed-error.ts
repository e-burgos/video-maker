import { AutoMontageError } from './auto-montage-error';

export type TranscriptionFailedStage = 'extract-audio' | 'transcribe' | 'persist';

export class TranscriptionFailedError extends AutoMontageError {
  readonly code = 'TRANSCRIPTION_FAILED';
  readonly assetId: string;
  readonly stage: TranscriptionFailedStage;

  constructor(init: { assetId: string; stage: TranscriptionFailedStage; cause?: unknown }) {
    super(`No se pudo transcribir "${init.assetId}" en la etapa "${init.stage}".`);
    this.name = 'TranscriptionFailedError';
    this.assetId = init.assetId;
    this.stage = init.stage;
    this.cause = init.cause;
  }
}
