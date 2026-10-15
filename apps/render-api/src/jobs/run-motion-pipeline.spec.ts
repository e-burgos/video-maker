import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveMediaProject } from '@video-maker/auto-montage';
import type { MotionPipelinePorts } from '@video-maker/motion-graphics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCallLog } from '../__fixtures__/call-log';
import { createFakeRenderApiDependencies } from '../__fixtures__/fake-render-api-dependencies';
import { toErrorPayload } from '../errors/to-error-payload';

const steps = vi.hoisted(() => ({ order: [] as string[], failAt: null as string | null, voiceOptions: null as Record<string, unknown> | null, renderOptions: null as Record<string, unknown> | null }));
const store = vi.hoisted(() => ({ files: new Map<string, string>(), copies: [] as string[][] }));

vi.mock('@video-maker/motion-graphics', async (importOriginal) => {
  const original = await importOriginal<typeof import('@video-maker/motion-graphics')>();
  const step = (name: string, result: unknown) => async () => {
    steps.order.push(name);
    if (steps.failAt === name) {
      throw new original.MotionStudioError('STAGE_FAILED', `${name} exploded`);
    }
    return result;
  };
  return {
    ...original,
    autoStoryboard: async (_ports: unknown, _brief: unknown, sourceDir: string) => {
      steps.order.push('autoStoryboard');
      store.files.set(`${sourceDir}/storyboard.json`, readFileSync(STORYBOARD_FIXTURE, 'utf8'));
      if (steps.failAt === 'autoStoryboard') {
        throw new original.MotionStudioError('AI_FAILED', 'agent down');
      }
      return { lines: [], repaired: true, usage: { inputTokens: 1200, outputTokens: 300, costUsd: 0.42 } };
    },
    composeFromStoryboard: step('composeFromStoryboard', { lines: [] }),
    voiceProject: async (_ports: unknown, _dir: string, options: { onLine?: (line: unknown) => void } & Record<string, unknown>) => {
      steps.voiceOptions = options;
      steps.order.push('voiceProject');
      options.onLine?.({ done: 1, total: 2 });
      options.onLine?.({ done: 2, total: 2 });
      if (steps.failAt === 'voiceProject') {
        throw new original.MotionStudioError('STAGE_FAILED', 'voiceProject exploded');
      }
      return { lines: [], voiced: [] };
    },
    planProject: step('planProject', { lines: [] }),
    composeProject: step('composeProject', { lines: [], scenes: 9, durationSec: 61.5 }),
    renderProject: async (_ports: unknown, _dir: string, options: Record<string, unknown>) => {
      steps.renderOptions = options;
      return step('renderProject', { lines: [], outPath: '', creditsPath: null, musicCredit: '"Tema" Autor · CC BY 4.0' })();
    },
  };
});

import { runMotionPipeline } from './run-motion-pipeline';
import type { MotionPipelineObserver } from './motion-pipeline-observer';

const STORYBOARD_FIXTURE = fileURLToPath(
  new URL('../../../../libs/motion-graphics/assets/storyboards/displayads/easy-pro.json', import.meta.url),
);
const PROJECT = resolveMediaProject('/media/promo');
const BRIEF = {
  version: 1,
  brand: 'displayads',
  script: 'Una pantalla apagada es plata perdida.',
  images: [{ file: 'shot.png', caption: 'Pantalla' }],
};
const REPORT_KEYS = ['durationSec', 'musicCredit', 'path', 'scenes', 'storyboard'];
const STORYBOARD_REPORT_KEYS = ['costUsd', 'repaired', 'tokensIn', 'tokensOut'];

function fakePorts(): MotionPipelinePorts {
  const unused = async (): Promise<never> => {
    throw new Error('port not expected in this test');
  };
  return {
    assetsRoot: '/assets',
    readText: async (path) => {
      const content = store.files.get(path);
      if (content === undefined) {
        throw new Error(`missing ${path}`);
      }
      return content;
    },
    writeText: async (path, content) => {
      store.files.set(path, content);
    },
    copyFile: async (from, to) => {
      store.copies.push([from, to]);
    },
    readBytes: unused,
    exists: unused,
    copyTree: unused,
    removeFile: unused,
    synthesize: unused,
    transcribe: unused,
    detectBeats: unused,
    measureLoudness: unused,
    trimAudio: unused,
    render: unused,
    askAgent: unused,
  };
}

function setup(cancelAfter?: number) {
  const events: string[] = [];
  let checks = 0;
  const observer: MotionPipelineObserver = {
    stageStarted: (stage) => events.push(`stage:${stage}`),
    lineVoiced: (done, total) => events.push(`line:${done}/${total}`),
    cancellationRequested: () => cancelAfter !== undefined && ++checks > cancelAfter,
  };
  const deps = createFakeRenderApiDependencies(createCallLog(), { motionPorts: () => fakePorts() });
  return { events, observer, deps };
}

beforeEach(() => {
  steps.order.length = 0;
  steps.failAt = null;
  steps.voiceOptions = null;
  steps.renderOptions = null;
  store.files.clear();
  store.copies.length = 0;
  store.files.set('/media/promo/motion/brief.json', JSON.stringify(BRIEF));
  store.files.set('/media/promo/motion/storyboard.json', readFileSync(STORYBOARD_FIXTURE, 'utf8'));
});

describe('runMotionPipeline', () => {
  it('phase storyboard copies the brief images, drafts the storyboard and stores it without rendering', async () => {
    const { deps, observer, events } = setup();

    const report = await runMotionPipeline({ project: PROJECT, phase: 'storyboard', output: 'video.mp4', takes: 5 }, deps, observer);

    expect(steps.order).toEqual(['autoStoryboard']);
    expect(events).toEqual(['stage:storyboard']);
    expect(store.copies).toEqual([['/media/promo/raw/images/shot.png', '/media/promo/work/motion/images/shot.png']]);
    expect(JSON.parse(store.files.get('/media/promo/motion/storyboard.json') ?? '{}')).toMatchObject({ version: 1 });
    expect(Object.keys(report).sort()).toEqual(REPORT_KEYS);
    expect(Object.keys(report.storyboard ?? {}).sort()).toEqual(STORYBOARD_REPORT_KEYS);
    expect(report).toMatchObject({
      path: null,
      durationSec: null,
      musicCredit: null,
      storyboard: { repaired: true, tokensIn: 1200, tokensOut: 300, costUsd: 0.42 },
    });
    expect(report.scenes).toBeGreaterThan(0);
  });

  it('carries the previous music volume over when the storyboard is regenerated', async () => {
    const previous = JSON.parse(readFileSync(STORYBOARD_FIXTURE, 'utf8')) as { music: { volume?: number } };
    previous.music.volume = 0.3;
    store.files.set('/media/promo/motion/storyboard.json', JSON.stringify(previous));
    const { deps, observer } = setup();

    await runMotionPipeline({ project: PROJECT, phase: 'storyboard', output: 'video.mp4', takes: 5 }, deps, observer);

    const stored = JSON.parse(store.files.get('/media/promo/motion/storyboard.json') ?? '{}') as { music: { volume: number } };
    expect(stored.music.volume).toBe(0.3);
  });

  it('keeps the drafted music volume when the previous storyboard had none', async () => {
    const previous = JSON.parse(readFileSync(STORYBOARD_FIXTURE, 'utf8')) as { music: { volume?: number } };
    delete previous.music.volume;
    store.files.set('/media/promo/motion/storyboard.json', JSON.stringify(previous));
    const { deps, observer } = setup();

    await runMotionPipeline({ project: PROJECT, phase: 'storyboard', output: 'video.mp4', takes: 5 }, deps, observer);

    const stored = JSON.parse(store.files.get('/media/promo/motion/storyboard.json') ?? '{}') as { music: { volume: number } };
    expect(stored.music.volume).toBe(0.15);
  });

  it('voices with reuseUnchanged so only edited scenes are re-synthesized', async () => {
    const { deps, observer } = setup();

    await runMotionPipeline({ project: PROJECT, phase: 'video', output: 'promo.mp4', takes: 3 }, deps, observer);

    expect(steps.voiceOptions).toMatchObject({ takes: 3, reuseUnchanged: true });
  });

  it('phase video runs compose, voice, plan, compose and render in order with voice progress', async () => {
    const { deps, observer, events } = setup();

    const report = await runMotionPipeline({ project: PROJECT, phase: 'video', output: 'promo.mp4', takes: 3 }, deps, observer);

    expect(steps.order).toEqual([
      'composeFromStoryboard',
      'voiceProject',
      'planProject',
      'composeProject',
      'renderProject',
    ]);
    expect(events).toEqual([
      'stage:storyboard',
      'stage:voice',
      'line:1/2',
      'line:2/2',
      'stage:plan',
      'stage:compose',
      'stage:render',
    ]);
    expect(Object.keys(report).sort()).toEqual(REPORT_KEYS);
    expect(report).toEqual({ path: 'out/promo.mp4', durationSec: 61.5, scenes: 9, musicCredit: '"Tema" Autor · CC BY 4.0', storyboard: null });
  });

  it('renders a sample to out/<name>.sample.mp4, cut to the requested seconds, and flags the report', async () => {
    const { deps, observer } = setup();

    const report = await runMotionPipeline(
      { project: PROJECT, phase: 'video', output: 'promo.mp4', takes: 3, sampleSeconds: 10 },
      deps,
      observer,
    );

    expect(steps.renderOptions).toMatchObject({ outPath: '/media/promo/out/promo.sample.mp4', sampleSeconds: 10 });
    expect(report).toMatchObject({ path: 'out/promo.sample.mp4', sample: true, durationSec: 10 });
  });

  it('renders the full video without a sample key in the options or the report', async () => {
    const { deps, observer } = setup();

    const report = await runMotionPipeline({ project: PROJECT, phase: 'video', output: 'promo.mp4', takes: 3 }, deps, observer);

    expect(steps.renderOptions).not.toHaveProperty('sampleSeconds');
    expect(report).not.toHaveProperty('sample');
  });

  it('phase all chains the storyboard step and the video steps and reports the storyboard usage', async () => {
    const { deps, observer } = setup();

    const report = await runMotionPipeline({ project: PROJECT, phase: 'all', output: 'video.mp4', takes: 5 }, deps, observer);

    expect(steps.order[0]).toBe('autoStoryboard');
    expect(steps.order.at(-1)).toBe('renderProject');
    expect(report.path).toBe('out/video.mp4');
    expect(report.storyboard).toMatchObject({ tokensIn: 1200 });
  });

  it('maps a MotionStudioError to its api code and the stage it happened in', async () => {
    steps.failAt = 'voiceProject';
    const { deps, observer } = setup();

    const failure = await runMotionPipeline({ project: PROJECT, phase: 'video', output: 'video.mp4', takes: 5 }, deps, observer).then(
      () => null,
      (error: unknown) => toErrorPayload(error),
    );

    expect(failure).toMatchObject({ code: 'MOTION_PIPELINE_FAILED', stage: 'voice' });
    expect(failure?.expected).toContain('voiceProject exploded');
  });

  it('maps an AI failure while drafting the storyboard to AI_AGENT_FAILED at the storyboard stage', async () => {
    steps.failAt = 'autoStoryboard';
    const { deps, observer } = setup();

    const failure = await runMotionPipeline({ project: PROJECT, phase: 'storyboard', output: 'video.mp4', takes: 5 }, deps, observer).then(
      () => null,
      (error: unknown) => toErrorPayload(error),
    );

    expect(failure).toMatchObject({ code: 'AI_AGENT_FAILED', stage: 'storyboard' });
  });

  it('stops before the next stage when the job is canceled', async () => {
    const { deps, observer } = setup(2);

    await expect(
      runMotionPipeline({ project: PROJECT, phase: 'video', output: 'video.mp4', takes: 5 }, deps, observer),
    ).rejects.toMatchObject({ name: 'MotionPipelineCanceledError', stage: 'plan' });
    expect(steps.order).toEqual(['composeFromStoryboard', 'voiceProject']);
  });
});
