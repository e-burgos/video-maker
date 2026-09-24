import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { DownloadItem, ManifestModels } from './model-downloads';
import { buildDownloadPlan, downloadAllModels, downloadAndInstall } from './model-downloads';

let tempDirs: string[] = [];
let servers: Server[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'model-downloads-spec-'));
  tempDirs.push(dir);
  return dir;
}

async function listen(server: Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('failed to bind test server');
  }
  return address.port;
}

afterEach(async () => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  servers = [];
});

function sha256Of(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function fakeItem(overrides: Partial<DownloadItem> & { partPath: string; content: Buffer }): DownloadItem {
  const { content, ...rest } = overrides;
  return {
    id: 'item',
    kind: 'whisperModel',
    url: 'http://unused',
    sizeBytes: content.length,
    sha256: sha256Of(content),
    install: async (partPath) => ({ path: partPath, sizeBytes: content.length, sha256: sha256Of(content) }),
    ...rest,
  };
}

describe('downloadAndInstall (real local HTTP server)', () => {
  it('downloads, verifies and installs a whole file in one pass', async () => {
    const dir = makeTempDir();
    const content = Buffer.from('a'.repeat(5000));
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-length': String(content.length) });
      res.end(content);
    });
    const port = await listen(server);

    const item = fakeItem({ url: `http://127.0.0.1:${port}/file`, partPath: join(dir, 'file.part'), content });
    const events: number[] = [];

    const result = await downloadAndInstall(item, (p) => events.push(p.bytesDownloaded));

    expect(result.ok).toBe(true);
    expect(result.artifact?.sizeBytes).toBe(content.length);
    expect(events[events.length - 1]).toBe(content.length);
  });

  it('resumes from a cut connection using a Range request, and the final file is byte-correct', async () => {
    const dir = makeTempDir();
    const content = Buffer.from('r'.repeat(20000));
    const cutAt = 8000;
    let requestCount = 0;

    const server = createServer((req, res) => {
      requestCount += 1;
      const range = req.headers.range;
      if (range === undefined) {
        res.writeHead(200, { 'content-length': String(content.length) });
        res.write(content.subarray(0, cutAt));
        setTimeout(() => res.destroy(), 50);
        return;
      }
      const start = Number(/bytes=(\d+)-/u.exec(range)?.[1] ?? '0');
      const remaining = content.subarray(start);
      res.writeHead(206, {
        'content-range': `bytes ${start}-${content.length - 1}/${content.length}`,
        'content-length': String(remaining.length),
      });
      res.end(remaining);
    });
    const port = await listen(server);

    const item = fakeItem({ url: `http://127.0.0.1:${port}/file`, partPath: join(dir, 'file.part'), content });

    const result = await downloadAndInstall(item, () => undefined);

    expect(requestCount).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.artifact?.sha256).toBe(sha256Of(content));
  });

  it('rejects and deletes the file when the server serves the wrong bytes', async () => {
    const dir = makeTempDir();
    const content = Buffer.from('x'.repeat(4000));
    const wrongContent = Buffer.from('y'.repeat(4000));

    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-length': String(wrongContent.length) });
      res.end(wrongContent);
    });
    const port = await listen(server);

    const partPath = join(dir, 'file.part');
    const item = fakeItem({ url: `http://127.0.0.1:${port}/file`, partPath, content });

    const result = await downloadAndInstall(item, () => undefined);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('sha256 mismatch');
    expect(existsSync(partPath)).toBe(false);
  });

  it('rejects when the downloaded size does not match the manifest size', async () => {
    const dir = makeTempDir();
    const content = Buffer.from('z'.repeat(3000));
    const shortContent = content.subarray(0, 2000);

    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-length': String(shortContent.length) });
      res.end(shortContent);
    });
    const port = await listen(server);

    const partPath = join(dir, 'file.part');
    const item = fakeItem({ url: `http://127.0.0.1:${port}/file`, partPath, content });

    const result = await downloadAndInstall(item, () => undefined);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('size mismatch');
  });

  it('skips the network entirely when a complete, verified .part file already exists', async () => {
    const dir = makeTempDir();
    const content = Buffer.from('cached'.repeat(1000));
    const partPath = join(dir, 'file.part');
    mkdirSync(dir, { recursive: true });
    writeFileSync(partPath, content);

    let requested = false;
    const server = createServer((_req, res) => {
      requested = true;
      res.writeHead(500);
      res.end();
    });
    const port = await listen(server);

    const item = fakeItem({ url: `http://127.0.0.1:${port}/file`, partPath, content });
    const result = await downloadAndInstall(item, () => undefined);

    expect(requested).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('discards a stale .part file that is larger than the expected size and restarts from zero', async () => {
    const dir = makeTempDir();
    const content = Buffer.from('fresh'.repeat(1000));
    const partPath = join(dir, 'file.part');
    mkdirSync(dir, { recursive: true });
    writeFileSync(partPath, Buffer.alloc(content.length + 500));

    let sawRangeHeader = false;
    const server = createServer((req, res) => {
      sawRangeHeader = req.headers.range !== undefined;
      res.writeHead(200, { 'content-length': String(content.length) });
      res.end(content);
    });
    const port = await listen(server);

    const item = fakeItem({ url: `http://127.0.0.1:${port}/file`, partPath, content });
    const result = await downloadAndInstall(item, () => undefined);

    expect(sawRangeHeader).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('reports failure when the install step itself throws', async () => {
    const dir = makeTempDir();
    const content = Buffer.from('installable');
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-length': String(content.length) });
      res.end(content);
    });
    const port = await listen(server);

    const item = fakeItem({
      url: `http://127.0.0.1:${port}/file`,
      partPath: join(dir, 'file.part'),
      content,
      install: async () => {
        throw new Error('extraction blew up');
      },
    });

    const result = await downloadAndInstall(item, () => undefined);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('extraction blew up');
  });
});

describe('buildDownloadPlan', () => {
  it('lays out final paths matching what the binaries resolver expects under VIDEO_MAKER_MODELS_DIR', async () => {
    const modelsDir = makeTempDir();
    const models: ManifestModels = {
      whisper: { name: 'ggml-large-v3-turbo-q5_0', url: 'http://unused/whisper.bin', sizeBytes: 4, sha256: sha256Of(Buffer.from('test')) },
      chromeHeadlessShell: { name: 'chrome-headless-shell-mac-arm64', url: 'http://unused/chrome.zip', sizeBytes: 0, sha256: '' },
      voices: [
        { id: 'es_AR-daniela-high', name: 'vits-piper-es_AR-daniela-high', url: 'http://unused/daniela.tar.bz2', sizeBytes: 0, sha256: '' },
      ],
    };

    const plan = buildDownloadPlan(models, modelsDir);

    expect(plan.map((item) => item.id)).toEqual(['whisperModel', 'voice:es_AR-daniela-high', 'chromeHeadlessShell']);

    const whisperItem = plan[0];
    mkdirSync(join(modelsDir, '.downloads'), { recursive: true });
    writeFileSync(whisperItem.partPath, Buffer.from('test'));
    const artifact = await whisperItem.install(whisperItem.partPath);
    expect(artifact.path).toBe(join(modelsDir, 'whisper-model.bin'));
    expect(readFileSync(artifact.path, 'utf8')).toBe('test');
  });
});

describe('downloadAllModels', () => {
  it('reports overall progress across multiple items', async () => {
    const dir = makeTempDir();
    const contentA = Buffer.from('a'.repeat(1000));
    const contentB = Buffer.from('b'.repeat(2000));

    const server = createServer((req, res) => {
      const body = req.url === '/a' ? contentA : contentB;
      res.writeHead(200, { 'content-length': String(body.length) });
      res.end(body);
    });
    const port = await listen(server);

    const items: DownloadItem[] = [
      fakeItem({ id: 'a', url: `http://127.0.0.1:${port}/a`, partPath: join(dir, 'a.part'), content: contentA }),
      fakeItem({ id: 'b', url: `http://127.0.0.1:${port}/b`, partPath: join(dir, 'b.part'), content: contentB }),
    ];

    const overallSnapshots: number[] = [];
    const results = await downloadAllModels(items, (p) => overallSnapshots.push(p.overallBytesDownloaded));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(Math.max(...overallSnapshots)).toBe(contentA.length + contentB.length);
  });
});
