import { AutoMontageError } from './auto-montage-error';

export type MontageInputReason =
  | 'catalog-missing'
  | 'no-aroll-asset'
  | 'aroll-asset-not-found'
  | 'music-asset-not-found'
  | 'logo-asset-not-found'
  | 'unknown-preset'
  | 'empty-aroll'
  | 'voice-track-missing'
  | 'voice-track-unreadable'
  | 'empty-voice-track';

export class MontageInputError extends AutoMontageError {
  readonly code = 'MONTAGE_INPUT_INVALID';
  readonly projectRoot: string;
  readonly reason: MontageInputReason;

  constructor(init: { projectRoot: string; reason: MontageInputReason }) {
    super(`El montaje de "${init.projectRoot}" no se puede armar: ${init.reason}.`);
    this.name = 'MontageInputError';
    this.projectRoot = init.projectRoot;
    this.reason = init.reason;
  }
}
