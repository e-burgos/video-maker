import { AutoMontageError } from './auto-montage-error';

export class PathEscapesProjectError extends AutoMontageError {
  readonly code = 'PATH_ESCAPES_PROJECT';
  readonly projectRoot: string;
  readonly attemptedPath: string;

  constructor(init: { projectRoot: string; attemptedPath: string }) {
    super(`La ruta "${init.attemptedPath}" sale de la raíz del proyecto "${init.projectRoot}".`);
    this.name = 'PathEscapesProjectError';
    this.projectRoot = init.projectRoot;
    this.attemptedPath = init.attemptedPath;
  }
}
