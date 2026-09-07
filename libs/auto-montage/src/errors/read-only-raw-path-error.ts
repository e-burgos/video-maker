import { AutoMontageError } from './auto-montage-error';

export class ReadOnlyRawPathError extends AutoMontageError {
  readonly code = 'READ_ONLY_RAW_PATH';
  readonly projectRoot: string;
  readonly attemptedPath: string;

  constructor(init: { projectRoot: string; attemptedPath: string }) {
    super(`"${init.attemptedPath}" está bajo raw/, que es de solo lectura en "${init.projectRoot}".`);
    this.name = 'ReadOnlyRawPathError';
    this.projectRoot = init.projectRoot;
    this.attemptedPath = init.attemptedPath;
  }
}
