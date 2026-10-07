import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeCommandRunner } from '../__fixtures__/fake-command-runner';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { createMotionPipelinePorts, listMotionBrandDocuments } from './motion-pipeline-adapters';

describe('createMotionPipelinePorts', () => {
  it('maps the effective agent usage to the lib shape and strips schema markers', async () => {
    const callLog = createCallLog();
    let received: unknown;
    const deps = createFakeRenderApiDependencies(callLog, {
      aiAgent: async (request) => {
        received = request;
        return { json: { ok: true }, usage: { tokensIn: 10, tokensOut: 4, costUsd: 0.5, durationMs: 9, model: 'sonnet' } };
      },
    });

    const response = await createMotionPipelinePorts(deps, '/assets').askAgent({
      systemPrompt: 's',
      userPrompt: 'u',
      jsonSchema: { $schema: 'x', $id: 'y', type: 'object' },
    });

    expect(response).toEqual({ json: { ok: true }, usage: { inputTokens: 10, outputTokens: 4, costUsd: 0.5 } });
    expect(received).toEqual({ systemPrompt: 's', userPrompt: 'u', jsonSchema: { type: 'object' } });
  });

  it('transcribes through the voice deps and converts milliseconds to seconds', async () => {
    const deps = createFakeRenderApiDependencies(createCallLog());

    const transcript = await createMotionPipelinePorts(deps, '/assets').transcribe('/tmp/take.wav');

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
    const ports = createMotionPipelinePorts(deps, '/assets');
    const outPath = join(await mkdtemp(join(tmpdir(), 'adapters-')), 'out', 'line.wav');

    await ports.synthesize({ text: 'hola', voice: 'es_AR-daniela-high', lengthScale: 1.08, outPath });

    expect(calls).toEqual([{ modelPath: '/usr/share/tts-voices/vits-piper-es_AR-daniela-high', lengthScale: 1.08 }]);
    await expect(ports.synthesize({ text: 'x', voice: 'ghost', lengthScale: 1, outPath })).rejects.toMatchObject({
      code: 'VOICE_ASSET_NOT_FOUND',
    });
  });

  it('lints then renders with hyperframes and fails on a non-zero exit', async () => {
    const calls: { args: readonly string[]; cwd: string }[] = [];
    const deps = createFakeRenderApiDependencies(createCallLog(), {
      runHyperframes: async (input) => {
        calls.push(input);
        return { exitCode: input.args[0] === 'render' ? 1 : 0, stderr: 'chrome crashed' };
      },
    });
    const outDir = await mkdtemp(join(tmpdir(), 'adapters-'));

    await expect(
      createMotionPipelinePorts(deps, '/assets').render({ projectDir: '/work', outPath: join(outDir, 'out', 'v.mp4'), fps: 30, quality: 'delivery' }),
    ).rejects.toMatchObject({ code: 'STAGE_FAILED', message: expect.stringContaining('chrome crashed') });

    expect(calls.map((call) => call.args[0])).toEqual(['lint', 'render']);
    expect(calls[1]?.args).toEqual(['render', '-f', '30', '-q', 'delivery', '-o', join(outDir, 'out', 'v.mp4')]);
    expect(calls.every((call) => call.cwd === '/work')).toBe(true);
  });

  it('trims audio with the resolved ffmpeg and fails on a non-zero exit', async () => {
    const runner = createFakeCommandRunner([{ bin: '/usr/bin/ffmpeg', response: { exitCode: 1, stderr: 'bad input' } }]);
    const deps = createFakeRenderApiDependencies(createCallLog(), { createCommandRunner: async () => runner });
    const to = join(await mkdtemp(join(tmpdir(), 'adapters-')), 'a', 'music.wav');

    await expect(createMotionPipelinePorts(deps, '/assets').trimAudio({ from: '/m.mp3', to, durationSec: 12.5 })).rejects.toMatchObject({
      code: 'STAGE_FAILED',
    });
    expect(runner.calls[0]?.args).toEqual(['-v', 'error', '-y', '-i', '/m.mp3', '-t', '12.5', '-ar', '48000', to]);
  });
});

describe('listMotionBrandDocuments', () => {
  let root: string;

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reads each brands/<id>/brand.json and skips folders without a manifest', async () => {
    root = await mkdtemp(join(tmpdir(), 'brands-'));
    await mkdir(join(root, 'brands', 'acme'), { recursive: true });
    await mkdir(join(root, 'brands', 'empty'), { recursive: true });
    await writeFile(join(root, 'brands', 'acme', 'brand.json'), '{"id":"acme"}');

    await expect(listMotionBrandDocuments(root)).resolves.toEqual([{ id: 'acme', manifest: { id: 'acme' } }]);
  });

  it('answers an empty list when the assets root has no brands folder', async () => {
    root = await mkdtemp(join(tmpdir(), 'brands-'));

    await expect(listMotionBrandDocuments(root)).resolves.toEqual([]);
  });

  it('rejects a brand.json that is not JSON', async () => {
    root = await mkdtemp(join(tmpdir(), 'brands-'));
    await mkdir(join(root, 'brands', 'bad'), { recursive: true });
    await writeFile(join(root, 'brands', 'bad', 'brand.json'), 'nope');

    await expect(listMotionBrandDocuments(root)).rejects.toMatchObject({ code: 'SERVER_CONFIG_INVALID' });
  });
});
