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

export { StudioToolRuntimeError } from './errors/studio-tool-runtime-error';

export type {
  RenderApiAssetEntry,
  RenderApiClient,
  RenderApiExtractedFrame,
  RenderApiFileBytes,
  RenderApiJob,
  RenderApiJobSummary,
  RenderApiMusicResult,
  RenderApiProbeResult,
  RenderApiProjectDetail,
  RenderApiVoice,
} from './client/render-api-client';
export { createHttpRenderApiClient, DEFAULT_HTTP_RENDER_API_CLIENT_TIMEOUT_MS } from './client/http-render-api-client';
export type { HttpRenderApiClientOptions } from './client/http-render-api-client';

export {
  createStudioToolHandlers,
  DEFAULT_WAIT_FOR_JOB_POLL_INTERVAL_MS,
  RECENT_JOBS_LIMIT,
} from './handlers/studio-tool-handlers';
export type {
  StudioToolHandler,
  StudioToolHandlerResult,
  StudioToolHandlersOptions,
} from './handlers/studio-tool-handlers';

export { createStudioMcpServer } from './mcp/studio-mcp-server';
export { buildStudioMcpLaunchCommand } from './mcp/studio-mcp-launch';
export type { StudioMcpLaunchCommand, StudioMcpLaunchInput } from './mcp/studio-mcp-launch';
export { parseStudioMcpCliArgs } from './mcp/studio-mcp-cli-args';
export type { StudioMcpCliArgs } from './mcp/studio-mcp-cli-args';

export { buildProducerPrompt, buildProducerProjectSection } from './prompt/build-producer-prompt';
export type { ProducerPromptAsset, ProducerPromptContext } from './prompt/build-producer-prompt';

export { buildStudioAiSdkTools } from './runtime/studio-ai-sdk-tools';
export type { StudioAiSdkToolsOptions } from './runtime/studio-ai-sdk-tools';

export {
  DEFAULT_MAX_STEPS,
  OpenRouterProducerRuntimeError,
  runOpenRouterProducerTurn,
  runProducerTurnWithModel,
} from './runtime/openrouter-producer-runtime';
export type {
  OpenRouterProducerRuntimeErrorCode,
  ProducerRuntimeEvent,
  ProducerRuntimeMessage,
  RunOpenRouterProducerTurnOptions,
  RunOpenRouterProducerTurnResult,
  RunOpenRouterProducerTurnUsage,
  RunProducerTurnWithModelOptions,
} from './runtime/openrouter-producer-runtime';
