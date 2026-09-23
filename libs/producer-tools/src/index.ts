export {
  STUDIO_MCP_SERVER_NAME,
  STUDIO_TOOL_NAMES,
  claudeCodeToolName,
  isStudioToolName,
} from './contract/tool-names';
export type { StudioToolName } from './contract/tool-names';

export {
  STUDIO_TOOL_ERROR_CODES,
  isStudioToolError,
} from './contract/tool-errors';
export type { StudioToolError, StudioToolErrorCode } from './contract/tool-errors';

export {
  DEFAULT_PHOTO_AROLL_FPS,
  MAX_EXTRACT_FRAMES_AT_SECONDS,
  MAX_SEARCH_FREE_MUSIC_RESULTS,
  MAX_WAIT_FOR_JOB_TIMEOUT_SECONDS,
  MIN_EXTRACT_FRAMES_AT_SECONDS,
  MIN_SEARCH_FREE_MUSIC_RESULTS,
  MIN_WAIT_FOR_JOB_TIMEOUT_SECONDS,
  ProjectRelativePathSchema,
  STUDIO_JOB_KINDS,
  STUDIO_JOB_STATUSES,
  STUDIO_TOOLS,
  StartJobInputSchema,
  StudioJobKindSchema,
  StudioJobStatusSchema,
  StudioToolErrorSchema,
} from './contract/tool-schemas';
export type {
  StartJobInput,
  StudioJobKind,
  StudioJobStatus,
  StudioToolDefinition,
} from './contract/tool-schemas';
