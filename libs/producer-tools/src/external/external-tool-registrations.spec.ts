import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { STUDIO_TOOL_NAMES } from '../contract/tool-names';
import { createMcpServerFromRegistrations } from '../mcp/studio-mcp-server';
import { EXTERNAL_ONLY_TOOL_NAMES } from './external-tool-definitions';
import { createExternalToolRegistrations } from './external-tool-registrations';
import type { StudioConnection } from './studio-connection';

interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: Uint8Array | string | null;
}

const ENDPOINT = { apiUrl: 'http://127.0.0.1:4520', accessToken: 'tok', source: 'dev' as const };

async function readBody(body: unknown): Promise<Uint8Array | string | null> {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return body;
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function recordingFetch(
  requests: RecordedRequest[],
  answer: (request: RecordedRequest) => { status: number; body: unknown },
): typeof fetch {
  return (async (url: string, init: { method: string; headers: Record<string, string>; body?: unknown }) => {
    const request: RecordedRequest = { method: init.method, url, headers: init.headers ?? {}, body: await readBody(init.body) };
    requests.push(request);
    const { status, body } = answer(request);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

async function connect(fetchImpl: typeof fetch, connection?: StudioConnection) {
  const registrations = createExternalToolRegistrations({
    connection: connection ?? { endpoint: async () => ENDPOINT, invalidate: () => undefined },
    fetchImpl,
  });
  const server = createMcpServerFromRegistrations(registrations);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('external tool registrations', () => {
  let scratch: string;

  beforeEach(async () => {
    scratch = await mkdtemp(join(tmpdir(), 'vm-external-'));
  });

  afterEach(async () => {
    await rm(scratch, { recursive: true, force: true });
  });

  it('exposes the new tools and the reused ones, never publishing or deleting', async () => {
    const client = await connect(recordingFetch([], () => ({ status: 200, body: {} })));

    const names = (await client.listTools()).tools.map((tool) => tool.name);

    for (const name of EXTERNAL_ONLY_TOOL_NAMES) expect(names).toContain(name);
    expect(names).not.toContain('queue_publication');
    expect(names).not.toContain('draft_publication');
    expect(names.filter((name) => /delete|remove/u.test(name))).toEqual([]);
    expect(names).toContain('start_job');
    expect(names.length).toBe(STUDIO_TOOL_NAMES.length - 2 + EXTERNAL_ONLY_TOOL_NAMES.length);
  });

  it('requires a slug on project tools and leaves the global ones without it', async () => {
    const client = await connect(recordingFetch([], () => ({ status: 200, body: {} })));
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    for (const name of ['get_project_overview', 'start_job', 'write_motion_brief', 'upload_asset', 'get_render_review']) {
      expect(byName.get(name)?.inputSchema.required ?? [], name).toContain('slug');
    }
    for (const name of ['list_voices', 'get_motion_brands', 'list_projects', 'list_brands', 'studio_status']) {
      expect(Object.keys(byName.get(name)?.inputSchema.properties ?? {}), name).not.toContain('slug');
    }
  });

  it('rejects a call without slug or with a malformed one', async () => {
    const requests: RecordedRequest[] = [];
    const client = await connect(recordingFetch(requests, () => ({ status: 200, body: {} })));

    const missing = await client.callTool({ name: 'get_project_overview', arguments: {} });
    const malformed = await client.callTool({ name: 'get_project_overview', arguments: { slug: '../etc' } });

    expect(missing.isError).toBe(true);
    expect(malformed.isError).toBe(true);
    expect(requests).toEqual([]);
  });

  it('routes a project tool to the slug it was given', async () => {
    const requests: RecordedRequest[] = [];
    const client = await connect(
      recordingFetch(requests, ({ url }) => {
        if (url.endsWith('/projects/demo/motion/brief')) return { status: 200, body: { version: 1 } };
        return { status: 404, body: { error: { code: 'UNKNOWN', message: 'nope' } } };
      }),
    );

    const result = await client.callTool({ name: 'read_motion_brief', arguments: { slug: 'demo' } });

    expect(result.structuredContent).toEqual({ brief: { version: 1 } });
    expect(requests[0]?.url).toBe('http://127.0.0.1:4520/projects/demo/motion/brief');
    expect(requests[0]?.headers['x-studio-token']).toBe('tok');
  });

  it('omits the model on storyboard jobs when none was configured', async () => {
    const requests: RecordedRequest[] = [];
    const client = await connect(
      recordingFetch(requests, () => ({ status: 202, body: { id: 'job-1', kind: 'storyboard', state: 'queued', progress: null, report: null, error: null } })),
    );

    await client.callTool({ name: 'start_job', arguments: { slug: 'demo', job: { kind: 'storyboard', brief: 'hola' } } });

    const sent = JSON.parse(String(requests.find((request) => request.method === 'POST')?.body));
    expect(sent.kind).toBe('storyboard');
    expect(sent).not.toHaveProperty('model');
  });

  it('uploads a local file to the asset route with its size and content type', async () => {
    const file = join(scratch, 'logo.png');
    await writeFile(file, Buffer.from([137, 80, 78, 71, 1, 2, 3]));
    const requests: RecordedRequest[] = [];
    const client = await connect(recordingFetch(requests, () => ({ status: 201, body: { path: 'raw/logo/logo.png', role: 'logo' } })));

    const result = await client.callTool({ name: 'upload_asset', arguments: { slug: 'demo', role: 'logo', filePath: file } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ path: 'raw/logo/logo.png', role: 'logo' });
    const upload = requests[0];
    expect(upload?.method).toBe('PUT');
    expect(upload?.url).toBe('http://127.0.0.1:4520/projects/demo/assets/logo/logo.png');
    expect(upload?.headers['content-type']).toBe('image/png');
    expect(upload?.headers['content-length']).toBe('7');
    expect([...(upload?.body as Uint8Array)]).toEqual([137, 80, 78, 71, 1, 2, 3]);
  });

  it('uses the requested file name and refuses roles the studio does not know', async () => {
    const file = join(scratch, 'x.mp4');
    await writeFile(file, 'video');
    const requests: RecordedRequest[] = [];
    const client = await connect(recordingFetch(requests, () => ({ status: 201, body: {} })));

    await client.callTool({ name: 'upload_asset', arguments: { slug: 'demo', role: 'aroll', filePath: file, filename: 'demo screen.mp4' } });
    const refused = await client.callTool({ name: 'upload_asset', arguments: { slug: 'demo', role: 'banner', filePath: file } });

    expect(requests[0]?.url).toBe('http://127.0.0.1:4520/projects/demo/assets/aroll/demo%20screen.mp4');
    expect(refused.isError).toBe(true);
    expect(requests).toHaveLength(1);
  });

  it('rejects relative paths and missing files before calling the studio', async () => {
    const requests: RecordedRequest[] = [];
    const client = await connect(recordingFetch(requests, () => ({ status: 201, body: {} })));

    const relative = await client.callTool({ name: 'upload_asset', arguments: { slug: 'demo', role: 'logo', filePath: 'logo.png' } });
    const missing = await client.callTool({ name: 'upload_asset', arguments: { slug: 'demo', role: 'logo', filePath: join(scratch, 'nope.png') } });

    expect(relative.isError).toBe(true);
    expect(missing.isError).toBe(true);
    expect(requests).toEqual([]);
  });

  it('uploads a brand file to the brand route', async () => {
    const file = join(scratch, 'brand-logo.svg');
    await writeFile(file, '<svg/>');
    const requests: RecordedRequest[] = [];
    const client = await connect(recordingFetch(requests, () => ({ status: 201, body: { path: 'logo/brand-logo.svg' } })));

    await client.callTool({ name: 'upload_brand_file', arguments: { id: 'acme', kind: 'logo', filePath: file } });

    expect(requests[0]?.url).toBe('http://127.0.0.1:4520/brands/acme/files/logo/brand-logo.svg');
    expect(requests[0]?.headers['content-type']).toBe('image/svg+xml');
  });

  it('creates a project and answers list_projects and studio_status', async () => {
    const requests: RecordedRequest[] = [];
    const client = await connect(
      recordingFetch(requests, ({ method, url }) => {
        if (method === 'POST') return { status: 201, body: { slug: 'plugin-smoke', mode: 'footage' } };
        if (url.endsWith('/projects')) return { status: 200, body: [{ slug: 'plugin-smoke' }] };
        return { status: 200, body: { service: 'render-api', status: 'ok', version: '0.4.3', capabilities: { producer: true } } };
      }),
    );

    const created = await client.callTool({ name: 'create_project', arguments: { slug: 'plugin-smoke' } });
    const listed = await client.callTool({ name: 'list_projects', arguments: {} });
    const status = await client.callTool({ name: 'studio_status', arguments: {} });

    expect(created.structuredContent).toMatchObject({ slug: 'plugin-smoke' });
    expect(JSON.parse(String(requests[0]?.body))).toEqual({ slug: 'plugin-smoke' });
    expect(listed.structuredContent).toEqual({ projects: [{ slug: 'plugin-smoke' }] });
    expect(status.structuredContent).toMatchObject({ apiUrl: ENDPOINT.apiUrl, source: 'dev', version: '0.4.3', status: 'ok' });
  });

  it('reports an unreachable studio and asks for a fresh resolution next time', async () => {
    let invalidated = 0;
    const connection: StudioConnection = { endpoint: async () => ENDPOINT, invalidate: () => (invalidated += 1) };
    const failing = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const client = await connect(failing, connection);

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect(result.isError).toBe(true);
    expect(invalidated).toBe(1);
  });
});
