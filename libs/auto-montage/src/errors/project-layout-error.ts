import { AutoMontageError } from './auto-montage-error';

export class ProjectLayoutError extends AutoMontageError {
  readonly code = 'PROJECT_LAYOUT_INVALID';
  readonly projectRoot: string;
  readonly missingPath: string;

  constructor(init: { projectRoot: string; missingPath: string }) {
    super(`El proyecto de medios en "${init.projectRoot}" no tiene "${init.missingPath}".`);
    this.name = 'ProjectLayoutError';
    this.projectRoot = init.projectRoot;
    this.missingPath = init.missingPath;
  }
}
