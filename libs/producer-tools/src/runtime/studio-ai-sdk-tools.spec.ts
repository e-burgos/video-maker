import { describe, expect, it } from 'vitest';

import { createFakeRenderApiClient } from '../__fixtures__/fake-render-api-client';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import { STUDIO_TOOL_NAMES } from '../contract/tool-names';
import { claudeCodeToolName } from '../contract/tool-names';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import { createStudioToolHandlers } from '../handlers/studio-tool-handlers';
import { buildStudioAiSdkTools } from './studio-ai-sdk-tools';

interface ToolLike {
  readonly description: string;
  readonly inputSchema: unknown;
  readonly execute: (input: unknown) => Promise<unknown>;
  readonly toModelOutput: (options: { toolCallId: string; input: unknown; output: unknown }) => unknown;
}

function toolFixture(overrides: Parameters<typeof createFakeRenderApiClient>[0] = {}, supportsImages = false) {
  const client = createFakeRenderApiClient(overrides);
  const handlers = createStudioToolHandlers({ client, model: 'sonnet' });
  return buildStudioAiSdkTools({ handlers, supportsImages }) as unknown as Record<string, ToolLike>;
}

describe('buildStudioAiSdkTools', () => {
  it('exposes every studio tool under its mcp__studio__ prefixed name', () => {
    const tools = toolFixture();

    const names = Object.keys(tools).sort();
    expect(names).toEqual(STUDIO_TOOL_NAMES.map((name) => claudeCodeToolName(name)).sort());
  });

  it('carries the contract description and zod input schema for each tool', () => {
    const tools = toolFixture();

    for (const name of STUDIO_TOOL_NAMES) {
      const entry = tools[claudeCodeToolName(name)];
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.inputSchema).toBeDefined();
    }
  });

  it('executes a successful tool call through createStudioToolHandlers and reports it as JSON', async () => {
    const timeline = buildMinimalTimeline();
    const tools = toolFixture({
      getTimeline: async () => timeline,
    });

    const entry = tools[claudeCodeToolName('get_timeline')];
    const output = await entry.execute({});
    const modelOutput = entry.toModelOutput({ toolCallId: 'call-1', input: {}, output }) as {
      type: string;
      value: unknown;
    };

    expect(modelOutput.type).toBe('json');
    expect(modelOutput.value).toEqual({ timeline });
  });

  it('returns the {code, hint} error as a recoverable error-json result instead of throwing', async () => {
    const tools = toolFixture({
      probeMedia: async () => {
        throw new StudioToolRuntimeError('FILE_NOT_FOUND', 'raw/aroll/missing.mp4 does not exist');
      },
    });

    const entry = tools[claudeCodeToolName('probe_media')];
    const output = await entry.execute({ path: 'raw/aroll/missing.mp4' });
    const modelOutput = entry.toModelOutput({ toolCallId: 'call-2', input: {}, output }) as {
      type: string;
      value: unknown;
    };

    expect(modelOutput).toEqual({
      type: 'error-json',
      value: { code: 'FILE_NOT_FOUND', hint: 'raw/aroll/missing.mp4 does not exist' },
    });
  });

  it('sends extract_frames images as content parts when the model supports images', async () => {
    const tools = toolFixture(
      {
        extractFrames: async () => [{ atSeconds: 1, path: 'work/producer/frames/t1000.jpg' }],
        readFileBytes: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }),
      },
      true,
    );

    const entry = tools[claudeCodeToolName('extract_frames')];
    const output = await entry.execute({ path: 'raw/aroll/a.mp4', atSeconds: [1] });
    const modelOutput = entry.toModelOutput({ toolCallId: 'call-3', input: {}, output }) as {
      type: string;
      value: readonly Record<string, unknown>[];
    };

    expect(modelOutput.type).toBe('content');
    const filePart = modelOutput.value.find((part) => part.type === 'file');
    expect(filePart).toMatchObject({
      type: 'file',
      mediaType: 'image/jpeg',
      data: { type: 'data', data: Buffer.from([1, 2, 3]).toString('base64') },
    });
    const textPart = modelOutput.value.find((part) => part.type === 'text');
    expect(textPart).toBeDefined();
  });

  it('sends extract_frames as text only when the model does not support images', async () => {
    const tools = toolFixture(
      {
        extractFrames: async () => [{ atSeconds: 1, path: 'work/producer/frames/t1000.jpg' }],
        readFileBytes: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }),
      },
      false,
    );

    const entry = tools[claudeCodeToolName('extract_frames')];
    const output = await entry.execute({ path: 'raw/aroll/a.mp4', atSeconds: [1] });
    const modelOutput = entry.toModelOutput({ toolCallId: 'call-4', input: {}, output }) as { type: string };

    expect(modelOutput.type).toBe('json');
  });
});
