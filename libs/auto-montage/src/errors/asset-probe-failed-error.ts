import { AutoMontageError } from './auto-montage-error';

export class AssetProbeFailedError extends AutoMontageError {
  readonly code = 'ASSET_PROBE_FAILED';
  readonly path: string;

  constructor(init: { path: string; cause?: unknown }) {
    super(`No se pudo sondear el asset "${init.path}".`);
    this.name = 'AssetProbeFailedError';
    this.path = init.path;
    this.cause = init.cause;
  }
}
