import { AutoMontageError } from './auto-montage-error';

export class EditDecisionListInvalidError extends AutoMontageError {
  readonly code = 'EDL_INVALID';
  readonly sourceAssetId: string;
  readonly issues: readonly string[];

  constructor(init: { sourceAssetId: string; issues: readonly string[] }) {
    super(`El EditDecisionList de "${init.sourceAssetId}" no es válido: ${init.issues.join('; ')}`);
    this.name = 'EditDecisionListInvalidError';
    this.sourceAssetId = init.sourceAssetId;
    this.issues = init.issues;
  }
}
