import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeCommandRunner } from '../__fixtures__/fake-command-runner';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { createMotionPipelinePorts, listMotionBrandDocuments } from './motion-pipeline-adapters';

describe('createMotionPipelinePorts', () => {
  it('maps the effective agent usage to the lib shape, strips schema markers and asks for low effort', async () => {
    const callLog = createCallLog();
    let received: unknown;
    const deps = createFakeRenderApiDependencies(callLog, {
      aiAgent: async (request) => {
        received = request;
        return { json: { ok: true }, usage: { tokensIn: 10, tokensOut: 4, costUsd: 0.5, durationMs: 9, model: 'sonnet' } };
      },
    });

    const response = await createMotionPipelinePorts(deps, '/assets', '/brands').askAgent({
      systemPrompt: 's',
      userPrompt: 'u',
      jsonSchema: { $schema: 'x', $id: 'y', type: 'object' },
    });

    expect(response).toEqual({ json: { ok: true }, usage: { inputTokens: 10, outputTokens: 4, costUsd: 0.5 } });
    expect(received).toEqual({ systemPrompt: 's', userPrompt: 'u', jsonSchema: { type: 'object' }, effort: 'low' });
  });

  it('transcribes through the voice deps and converts milliseconds to seconds', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const transcript = await createMotionPipelinePorts(deps, '/assets', '/brands').transcribe('/tmp/take.wav');

    expect(transcript).toEqual({
      text: 'hola mundo',
      words: [
        { text: 'hola', start: 0, end: 0.4 },
        { text: 'mundo', start: 0.4, end: 0.9 },
      ],
    });
  });

  it('synthesizes with the voice model directory and rejects an unknown voice', async () => {
    const callLog = createCallLog();
    const calls: { modelPath: string; lengthScale?: number }[] = [];
    const deps = createFakeRenderApiDependencies(callLog, {
      synthesizeVoice: async (input) => {
        calls.push({ modelPath: input.modelPath, ...(input.lengthScale === undefined ? {} : { lengthScale: input.lengthScale }) });
      },
    });
    const ports = createMotionPipelinePorts(deps, '/assets', '/brands');
    const outPath = join(await mkdtemp(join(tmpdir(), 'adapters-')), 'out', 'line.wav');

    await ports.synthesize({ text: 'hola', voice: 'es_AR-daniela-high', lengthScale: 1.08, outPath });

    expect(calls).toEqual([{ modelPath: '/usr/share/tts-voices/vits-piper-es_AR-daniela-high', lengthScale: 1.08 }]);
    await expect(ports.synthesize({ text: 'x', voice: 'ghost', lengthScale: 1, outPath })).rejects.toMatchObject({
      code: 'VOICE_ASSET_NOT_FOUND',
    });
  });

  it('reports the lint error lines hyperframes prints on stdout when the lint fails', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      runHyperframes: async () => ({
        exitCode: 1,
        stdout: '  ⚠ timeline_track_too_dense: Track 1 has 8 timed elements\n  ✗ missing_local_asset: <img> element references local file(s) not found in the project: assets/brand/escena-04\n◇  1 error(s), 1 warning(s)',
        stderr: '',
      }),
    });
    const outDir = await mkdtemp(join(tmpdir(), 'adapters-'));

    await expect(
      createMotionPipelinePorts(deps, '/assets', '/brands').render({ projectDir: '/work', outPath: join(outDir, 'v.mp4'), fps: 30, quality: 'delivery' }),
    ).rejects.toMatchObject({ code: 'STAGE_FAILED', message: expect.stringMatching(/hyperframes lint failed: ✗ missing_local_asset: .*escena-04$/u) });
  });

  it('lints then renders with hyperframes and fails on a non-zero exit', async () => {
    const calls: { args: readonly string[]; cwd: string }[] = [];
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      runHyperframes: async (input) => {
        calls.push(input);
        return { exitCode: input.args[0] === 'render' ? 1 : 0, stdout: '', stderr: 'chrome crashed' };
      },
    });
    const outDir = await mkdtemp(join(tmpdir(), 'adapters-'));

    await expect(
      createMotionPipelinePorts(deps, '/assets', '/brands').render({ projectDir: '/work', outPath: join(outDir, 'out', 'v.mp4'), fps: 30, quality: 'delivery' }),
    ).rejects.toMatchObject({ code: 'STAGE_FAILED', message: expect.stringContaining('chrome crashed') });

    expect(calls.map((call) => call.args[0])).toEqual(['lint', 'render']);
    expect(calls[1]?.args).toEqual(['render', '-f', '30', '-q', 'delivery', '-o', join(outDir, 'out', 'v.mp4')]);
    expect(calls.every((call) => call.cwd === '/work')).toBe(true);
  });

  it('trims audio with the resolved ffmpeg and fails on a non-zero exit', async () => {
    const runner = createFakeCommandRunner([{ bin: '/usr/bin/ffmpeg', response: { exitCode: 1, stderr: 'bad input' } }]);
    const deps = createFakeRenderApiDependencies(createCallLog(), { createCommandRunner: async () => runner });
    const to = join(await mkdtemp(join(tmpdir(), 'adapters-')), 'a', 'music.wav');

    await expect(createMotionPipelinePorts(deps, '/assets', '/brands').trimAudio({ from: '/m.mp3', to, durationSec: 12.5 })).rejects.toMatchObject({
      code: 'STAGE_FAILED',
    });
    expect(runner.calls[0]?.args).toEqual(['-v', 'error', '-y', '-i', '/m.mp3', '-t', '12.5', '-ar', '48000', to]);
  });
});

describe('listMotionBrandDocuments', () => {
  let root: string;
  let userRoot: string;

  const roots = () => ({ builtInAssetsRoot: root, userBrandsRoot: userRoot });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(userRoot, { recursive: true, force: true });
  });

  async function setupRoots(): Promise<void> {
    root = await mkdtemp(join(tmpdir(), 'brands-'));
    userRoot = await mkdtemp(join(tmpdir(), 'user-brands-'));
  }

  it('reads each brands/<id>/brand.json and skips folders without a manifest', async () => {
    await setupRoots();
    await mkdir(join(root, 'brands', 'acme'), { recursive: true });
    await mkdir(join(root, 'brands', 'empty'), { recursive: true });
    await writeFile(join(root, 'brands', 'acme', 'brand.json'), '{"id":"acme"}');

    await expect(listMotionBrandDocuments(roots())).resolves.toEqual([{ id: 'acme', source: 'built-in', manifest: { id: 'acme' } }]);
  });

  it('answers an empty list when neither root has brands', async () => {
    await setupRoots();

    await expect(listMotionBrandDocuments({ builtInAssetsRoot: root, userBrandsRoot: join(userRoot, 'missing') })).resolves.toEqual([]);
  });

  it('rejects a built-in brand.json that is not JSON', async () => {
    await setupRoots();
    await mkdir(join(root, 'brands', 'bad'), { recursive: true });
    await writeFile(join(root, 'brands', 'bad', 'brand.json'), 'nope');

    await expect(listMotionBrandDocuments(roots())).rejects.toMatchObject({ code: 'SERVER_CONFIG_INVALID' });
  });

  it('lists the user brands after the built-in ones, skips the trash and reports unreadable manifests', async () => {
    await setupRoots();
    await mkdir(join(root, 'brands', 'acme'), { recursive: true });
    await writeFile(join(root, 'brands', 'acme', 'brand.json'), '{"id":"acme"}');
    await mkdir(join(userRoot, 'mine'), { recursive: true });
    await writeFile(join(userRoot, 'mine', 'brand.json'), '{"id":"mine"}');
    await mkdir(join(userRoot, 'broken'), { recursive: true });
    await writeFile(join(userRoot, 'broken', 'brand.json'), 'nope');
    await mkdir(join(userRoot, '.trash', 'old-1'), { recursive: true });
    await writeFile(join(userRoot, '.trash', 'old-1', 'brand.json'), '{"id":"old"}');
    const skipped: unknown[] = [];

    const documents = await listMotionBrandDocuments(roots(), { skipped: (reason) => skipped.push(reason) });

    expect(documents.map((document) => `${document.source}:${document.id}`)).toEqual(['built-in:acme', 'user:mine']);
    expect(skipped).toEqual([{ id: 'broken', why: 'unreadable' }]);
  });

  it('keeps the built-in brand and reports a user brand with the same id', async () => {
    await setupRoots();
    await mkdir(join(root, 'brands', 'acme'), { recursive: true });
    await writeFile(join(root, 'brands', 'acme', 'brand.json'), '{"id":"acme","name":"Built-in"}');
    await mkdir(join(userRoot, 'acme'), { recursive: true });
    await writeFile(join(userRoot, 'acme', 'brand.json'), '{"id":"acme","name":"Clone"}');
    const skipped: unknown[] = [];

    const documents = await listMotionBrandDocuments(roots(), { skipped: (reason) => skipped.push(reason) });

    expect(documents).toEqual([{ id: 'acme', source: 'built-in', manifest: { id: 'acme', name: 'Built-in' } }]);
    expect(skipped).toEqual([{ id: 'acme', why: 'collides-with-built-in' }]);
  });
});
