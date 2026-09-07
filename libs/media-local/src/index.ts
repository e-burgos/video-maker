export type { CommandOptions, CommandResult, CommandRunner } from './runner/command-runner';

export { ExecaCommandRunner, SPAWN_FAILURE_EXIT_CODE } from './runner/execa-command-runner';
export type { ExecaCommandRunnerOptions } from './runner/execa-command-runner';

export { FixtureCommandRunner } from './runner/fixture-command-runner';
export type {
  FixtureCall,
  FixtureResponse,
  FixtureResponseFactory,
  FixtureRoute,
} from './runner/fixture-command-runner';

export { isMediaLocalError, MediaLocalError } from './errors/media-local-error';
export type { MediaLocalErrorCode } from './errors/media-local-error';

export { BinaryNotFoundError } from './errors/binary-not-found-error';
export { CommandFailedError, STDERR_MAX_BYTES, truncateStderr } from './errors/command-failed-error';
export { SAMPLE_MAX_CHARS, UnparseableOutputError } from './errors/unparseable-output-error';

export { nodeBinaryLookup } from './fs/binary-lookup';
export type { BinaryLookup } from './fs/binary-lookup';

export {
  BINARY_COMMAND_NAMES,
  BINARY_ENV_VARS,
  resolveBinaries,
  resolveBinary,
} from './binaries/resolve-binaries';
export type { BinaryName, ResolvedBinaries, ResolveBinariesOptions } from './binaries/resolve-binaries';
