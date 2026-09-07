import { AutoMontageError } from './auto-montage-error';

export class CatalogUnreadableError extends AutoMontageError {
  readonly code = 'CATALOG_UNREADABLE';
  readonly catalogPath: string;
  readonly issues: readonly string[];

  constructor(init: { catalogPath: string; issues: readonly string[]; cause?: unknown }) {
    super(`El catálogo en "${init.catalogPath}" no se pudo leer: ${init.issues.join('; ')}`);
    this.name = 'CatalogUnreadableError';
    this.catalogPath = init.catalogPath;
    this.issues = init.issues;
    this.cause = init.cause;
  }
}
