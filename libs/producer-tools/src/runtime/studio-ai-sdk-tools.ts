import { tool } from 'ai';
import type { JSONValue, ToolSet } from 'ai';

import { claudeCodeToolName, STUDIO_TOOL_NAMES } from '../contract/tool-names';
import type { StudioToolName } from '../contract/tool-names';
import { isStudioToolError } from '../contract/tool-errors';
import type { StudioToolErrorCode } from '../contract/tool-errors';
import { STUDIO_TOOLS } from '../contract/tool-schemas';
import type { StudioToolHandler } from '../handlers/studio-tool-handlers';

export interface StudioAiSdkToolsOptions {
  readonly handlers: Readonly<Record<StudioToolName, StudioToolHandler>>;
  readonly supportsImages: boolean;
}

interface StudioAiSdkToolOutput {
  readonly data: unknown;
  readonly images?: readonly { readonly mimeType: string; readonly base64: string }[] | undefined;
  readonly error?: { readonly code: StudioToolErrorCode; readonly hint: string } | undefined;
}

function toErrorOutput(cause: unknown): { code: StudioToolErrorCode; hint: string } {
  return isStudioToolError(cause)
    ? { code: cause.code, hint: cause.hint }
    : { code: 'STUDIO_UNAVAILABLE', hint: 'the studio tool failed for an unexpected reason' };
}

export function buildStudioAiSdkTools(options: StudioAiSdkToolsOptions): ToolSet {
  const { handlers, supportsImages } = options;
  const tools: ToolSet = {};

  for (const name of STUDIO_TOOL_NAMES) {
    const definition = STUDIO_TOOLS[name];
    const handler = handlers[name];

    tools[claudeCodeToolName(name)] = tool({
      description: definition.description,
      inputSchema: definition.input,
      execute: async (input: unknown): Promise<StudioAiSdkToolOutput> => {
        try {
          const result = await handler(input);
          return { data: result.data, images: result.images };
        } catch (cause) {
          return { data: null, error: toErrorOutput(cause) };
        }
      },
      toModelOutput: ({ output }) => {
        if (output.error !== undefined) {
          return { type: 'error-json', value: output.error };
        }
        if (supportsImages && output.images !== undefined && output.images.length > 0) {
          return {
            type: 'content',
            value: [
              ...output.images.map((image) => ({
                type: 'file' as const,
                data: { type: 'data' as const, data: image.base64 },
                mediaType: image.mimeType,
              })),
              { type: 'text' as const, text: JSON.stringify(output.data) },
            ],
          };
        }
        return { type: 'json', value: output.data as JSONValue };
      },
    });
  }

  return tools;
}
