import type { StudioToolError, StudioToolErrorCode } from '../contract/tool-errors';

export class StudioToolRuntimeError extends Error implements StudioToolError {
  readonly code: StudioToolErrorCode;
  readonly hint: string;

  constructor(code: StudioToolErrorCode, hint: string) {
    super(hint);
    this.name = 'StudioToolRuntimeError';
    this.code = code;
    this.hint = hint;
  }
}
