import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ContentBlock } from '@modelcontextprotocol/sdk/types.js';

import { STUDIO_MCP_SERVER_NAME, STUDIO_TOOL_NAMES } from '../contract/tool-names';
import type { StudioToolName } from '../contract/tool-names';
import { isStudioToolError } from '../contract/tool-errors';
import { STUDIO_TOOLS } from '../contract/tool-schemas';
import type { StudioToolHandler } from '../handlers/studio-tool-handlers';

const STUDIO_MCP_SERVER_VERSION = '0.1.0';

// Claude Code CLI 2.1.123 forwards structuredContent to the model instead of image content blocks, so image-carrying tools must omit outputSchema entirely.
const TOOLS_WITHOUT_OUTPUT_SCHEMA: ReadonlySet<StudioToolName> = new Set(['extract_frames', 'view_images']);

function toCallToolResult(
  data: unknown,
  images: readonly { readonly mimeType: string; readonly base64: string }[] | undefined,
): CallToolResult {
  if (images !== undefined && images.length > 0) {
    const content: ContentBlock[] = images.map((image) => ({
      type: 'image',
      data: image.base64,
      mimeType: image.mimeType,
    }));
    content.push({ type: 'text', text: JSON.stringify(data) });
    return { content };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data as Record<string, unknown>,
  };
}

function toErrorResult(cause: unknown): CallToolResult {
  const error = isStudioToolError(cause)
    ? { code: cause.code, hint: cause.hint }
    : { code: 'STUDIO_UNAVAILABLE' as const, hint: 'the studio tool failed for an unexpected reason' };

  return {
    content: [{ type: 'text', text: JSON.stringify(error) }],
    isError: true,
  };
}

export function createStudioMcpServer(handlers: Readonly<Record<StudioToolName, StudioToolHandler>>): McpServer {
  const server = new McpServer(
    { name: STUDIO_MCP_SERVER_NAME, version: STUDIO_MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  for (const name of STUDIO_TOOL_NAMES) {
    const definition = STUDIO_TOOLS[name];
    const handler = handlers[name];

    server.registerTool(
      name,
      TOOLS_WITHOUT_OUTPUT_SCHEMA.has(name)
        ? { description: definition.description, inputSchema: definition.input }
        : { description: definition.description, inputSchema: definition.input, outputSchema: definition.output },
      async (args: unknown) => {
        try {
          const result = await handler(args);
          return toCallToolResult(result.data, result.images);
        } catch (cause) {
          return toErrorResult(cause);
        }
      },
    );
  }

  return server;
}
