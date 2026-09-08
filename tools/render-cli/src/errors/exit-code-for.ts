import { isRenderCliError } from './render-cli-error';
import type { Stage } from './render-cli-error';

const STAGE_FAILED_EXIT_CODE: Record<Stage, number> = {
  ingest: 4,
  plan: 5,
  render: 6,
};

export function exitCodeFor(error: unknown): number {
  if (!isRenderCliError(error)) {
    return 1;
  }

  switch (error.code) {
    case 'CLI_USAGE':
    case 'CLI_ARGUMENT':
      return 2;
    case 'STAGE_INPUT_MISSING':
      return 3;
    case 'STAGE_FAILED':
      return error.stage === null ? 1 : STAGE_FAILED_EXIT_CODE[error.stage];
  }
}
