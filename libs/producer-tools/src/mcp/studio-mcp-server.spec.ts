import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { createFakeRenderApiClient } from '../__fixtures__/fake-render-api-client';
import { buildMinimalTimeline } from '../__fixtures__/minimal-timeline';
import type { RenderApiClient } from '../client/render-api-client';
import { STUDIO_TOOL_NAMES } from '../contract/tool-names';
import { StudioToolRuntimeError } from '../errors/studio-tool-runtime-error';
import { createStudioToolHandlers } from '../handlers/studio-tool-handlers';
import { createStudioMcpServer } from './studio-mcp-server';

async function connectedPair(overrides: Partial<RenderApiClient> = {}) {
  const fakeClient = createFakeRenderApiClient(overrides);
  const handlers = createStudioToolHandlers({ client: fakeClient, model: 'sonnet' });
  const server = createStudioMcpServer(handlers);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, server };
}

describe('createStudioMcpServer', () => {
  it('lists exactly the 22 contract tool names', async () => {
    const { client } = await connectedPair();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([...STUDIO_TOOL_NAMES].sort());
  });

  it('answers get_timeline with structuredContent matching the contract shape', async () => {
    const timeline = buildMinimalTimeline();
    const { client } = await connectedPair({ getTimeline: async () => timeline });

    const result = await client.callTool({ name: 'get_timeline', arguments: {} });

    expect(result.structuredContent).toEqual({ timeline });
    expect(result.isError).toBeFalsy();
  });

  it('returns an isError result with { code, hint } JSON text when the tool fails', async () => {
    const { client } = await connectedPair({
      probeMedia: async () => {
        throw new StudioToolRuntimeError('FILE_NOT_FOUND', 'raw/aroll/x.mp4 does not exist');
      },
    });

    const result = await client.callTool({ name: 'probe_media', arguments: { path: 'raw/aroll/x.mp4' } });

    expect(result.isError).toBe(true);
    const content = result.content as readonly { type: string; text?: string }[];
    expect(JSON.parse(content[0]?.text ?? '')).toEqual({
      code: 'FILE_NOT_FOUND',
      hint: 'raw/aroll/x.mp4 does not exist',
    });
  });

  it('rejects a schema-invalid call via the SDK input validation, never reaching the handler or a StudioToolRuntimeError', async () => {
    const { client } = await connectedPair();

    const result = await client.callTool({ name: 'probe_media', arguments: { path: '/etc/passwd' } });

    expect(result.isError).toBe(true);
  });

  it('returns an image content block alongside the text block for extract_frames', async () => {
    const { client } = await connectedPair({
      extractFrames: async () => [{ atSeconds: 1, path: 'work/producer/frames/t1000.jpg' }],
      readFileBytes: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }),
    });

    const result = await client.callTool({
      name: 'extract_frames',
      arguments: { path: 'raw/aroll/a.mp4', atSeconds: [1] },
    });

    const content = result.content as readonly { type: string; mimeType?: string; data?: string }[];
    expect(content.some((block) => block.type === 'text')).toBe(true);
    const image = content.find((block) => block.type === 'image');
    expect(image).toMatchObject({ mimeType: 'image/jpeg', data: Buffer.from([1, 2, 3]).toString('base64') });
    expect(result.structuredContent).toBeUndefined();
  });

  it('does not advertise an outputSchema for extract_frames, unlike the other contract tools', async () => {
    const { client } = await connectedPair();

    const { tools } = await client.listTools();

    const extractFrames = tools.find((tool) => tool.name === 'extract_frames');
    const getTimeline = tools.find((tool) => tool.name === 'get_timeline');
    expect(extractFrames?.outputSchema).toBeUndefined();
    expect(getTimeline?.outputSchema).toBeDefined();
  });

  it('returns an image content block alongside the text block for view_images', async () => {
    const { client } = await connectedPair({
      previewImages: async () => [{ path: 'raw/images/a.jpg', previewPath: 'work/frames/previews/a.jpg' }],
      readFileBytes: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }),
    });

    const result = await client.callTool({ name: 'view_images', arguments: { paths: ['raw/images/a.jpg'] } });

    const content = result.content as readonly { type: string; mimeType?: string; data?: string }[];
    expect(content.some((block) => block.type === 'text')).toBe(true);
    const image = content.find((block) => block.type === 'image');
    expect(image).toMatchObject({ mimeType: 'image/jpeg', data: Buffer.from([1, 2, 3]).toString('base64') });
    expect(result.structuredContent).toBeUndefined();
  });

  it('does not advertise an outputSchema for view_images, unlike the other contract tools', async () => {
    const { client } = await connectedPair();

    const { tools } = await client.listTools();

    const viewImages = tools.find((tool) => tool.name === 'view_images');
    expect(viewImages?.outputSchema).toBeUndefined();
  });

  it('injects the model into a voice start_job call', async () => {
    const { client } = await connectedPair({
      createJob: async (body) => ({
        id: 'job-1',
        kind: (body as { kind: string }).kind,
        state: 'queued',
        progress: null,
        report: null,
        error: null,
      }),
    });

    const result = await client.callTool({ name: 'start_job', arguments: { job: { kind: 'voice' } } });

    expect(result.structuredContent).toEqual({ jobId: 'job-1', kind: 'voice', status: 'queued' });
  });

  it('rejects a start_job call whose input is not wrapped in "job"', async () => {
    const { client } = await connectedPair();

    const result = await client.callTool({ name: 'start_job', arguments: { kind: 'render' } });

    expect(result.isError).toBe(true);
  });

  it('publishes a full JSON schema for start_job, with "job" as a union by kind', async () => {
    const { client } = await connectedPair();

    const { tools } = await client.listTools();
    const startJob = tools.find((tool) => tool.name === 'start_job');

    expect(startJob?.inputSchema.type).toBe('object');
    const properties = startJob?.inputSchema.properties as Record<string, unknown> | undefined;
    const job = properties?.job as Record<string, unknown> | undefined;
    expect(job).toBeDefined();
    const union = (job?.anyOf ?? job?.oneOf) as readonly unknown[] | undefined;
    expect(union?.length).toBe(6);
  });
});
