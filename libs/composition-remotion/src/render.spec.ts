import { describe, expect, it, vi } from 'vitest';
import { buildExampleTimeline } from './__fixtures__/example-timeline';
import { TIMELINE_COMPOSITION_ID } from './components/timeline-composition';
import {
  DEFAULT_RENDER_CONCURRENCY,
  RenderTimelineError,
  remotionRenderDeps,
  renderTimeline,
} from './render';
import type { CompositionMetadata, RenderTimelineDeps } from './render';

function fakeComposition(overrides: Partial<CompositionMetadata> = {}): CompositionMetadata {
  return {
    id: TIMELINE_COMPOSITION_ID,
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 265,
    defaultProps: {},
    props: {},
    defaultCodec: null,
    defaultOutName: null,
    defaultVideoImageFormat: null,
    defaultPixelFormat: null,
    defaultProResProfile: null,
    defaultSampleRate: null,
    ...overrides,
  };
}

function createRecordingDeps(overrides: Partial<RenderTimelineDeps> = {}): RenderTimelineDeps {
  return {
    bundleProject: vi.fn(async () => 'file:///serve-url/'),
    selectTimelineComposition: vi.fn(async () => fakeComposition()),
    renderTimelineMedia: vi.fn(async () => undefined),
    ...overrides,
  };
}

function invalidTimeline(): unknown {
  const timeline = buildExampleTimeline('reels-9x16');
  const invalid: Record<string, unknown> = { ...timeline };
  delete invalid.format;
  return invalid;
}

describe('renderTimeline', () => {
  it('bundlea, selecciona la composición y renderiza con los argumentos del contrato (CA-027)', async () => {
    const timeline = buildExampleTimeline('reels-9x16');
    const deps = createRecordingDeps();

    const result = await renderTimeline(timeline, { outPath: 'out/example-9x16.mp4' }, deps);

    expect(deps.bundleProject).toHaveBeenCalledWith({
      entryPoint: expect.stringContaining('remotion-entry.ts'),
      publicDir: null,
    });
    expect(deps.selectTimelineComposition).toHaveBeenCalledWith({
      serveUrl: 'file:///serve-url/',
      id: TIMELINE_COMPOSITION_ID,
      inputProps: { timeline },
    });
    expect(deps.renderTimelineMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        serveUrl: 'file:///serve-url/',
        codec: 'h264',
        outputLocation: 'out/example-9x16.mp4',
        concurrency: DEFAULT_RENDER_CONCURRENCY,
        inputProps: { timeline },
      }),
    );
    expect(result).toEqual({
      outPath: 'out/example-9x16.mp4',
      compositionId: TIMELINE_COMPOSITION_ID,
      width: 1080,
      height: 1920,
      fps: 30,
      durationInFrames: 265,
    });
  });

  it('el resultado sale de la composición resuelta, no de la Timeline de entrada', async () => {
    const timeline = buildExampleTimeline('youtube-16x9');
    const deps = createRecordingDeps({
      selectTimelineComposition: vi.fn(async () =>
        fakeComposition({ id: 'Custom', width: 640, height: 360, fps: 24, durationInFrames: 10 }),
      ),
    });

    const result = await renderTimeline(
      timeline,
      { outPath: 'out/custom.mp4', compositionId: 'Custom' },
      deps,
    );

    expect(result).toEqual({
      outPath: 'out/custom.mp4',
      compositionId: 'Custom',
      width: 640,
      height: 360,
      fps: 24,
      durationInFrames: 10,
    });
    expect(deps.selectTimelineComposition).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Custom' }),
    );
  });

  it('propaga concurrency, entryPoint y publicDir explícitos', async () => {
    const timeline = buildExampleTimeline('reels-9x16');
    const deps = createRecordingDeps();

    await renderTimeline(
      timeline,
      {
        outPath: 'out/explicit.mp4',
        concurrency: 2,
        entryPoint: '/custom/remotion-entry.ts',
        publicDir: '/custom/public',
      },
      deps,
    );

    expect(deps.bundleProject).toHaveBeenCalledWith({
      entryPoint: '/custom/remotion-entry.ts',
      publicDir: '/custom/public',
    });
    expect(deps.renderTimelineMedia).toHaveBeenCalledWith(
      expect.objectContaining({ concurrency: 2, outputLocation: 'out/explicit.mp4' }),
    );
  });

  it('reenvía onProgress a renderTimelineMedia', async () => {
    const timeline = buildExampleTimeline('reels-9x16');
    const onProgress = vi.fn();
    const deps = createRecordingDeps();

    await renderTimeline(timeline, { outPath: 'out/progress.mp4', onProgress }, deps);

    expect(deps.renderTimelineMedia).toHaveBeenCalledWith(expect.objectContaining({ onProgress }));
  });

  it('CE-1/RN-14: una Timeline inválida rechaza con INVALID_TIMELINE sin llamar a bundleProject', async () => {
    const deps = createRecordingDeps();

    await expect(
      renderTimeline(invalidTimeline() as never, { outPath: 'out/invalid.mp4' }, deps),
    ).rejects.toBeInstanceOf(RenderTimelineError);
    expect(deps.bundleProject).not.toHaveBeenCalled();
    expect(deps.selectTimelineComposition).not.toHaveBeenCalled();
    expect(deps.renderTimelineMedia).not.toHaveBeenCalled();
  });

  it('RenderTimelineError conserva el code y los issues de validateTimeline', async () => {
    const deps = createRecordingDeps();

    try {
      await renderTimeline(invalidTimeline() as never, { outPath: 'out/invalid.mp4' }, deps);
      expect.unreachable('renderTimeline debía rechazar');
    } catch (error) {
      expect(error).toBeInstanceOf(RenderTimelineError);
      expect((error as RenderTimelineError).code).toBe('INVALID_TIMELINE');
      expect((error as RenderTimelineError).issues.length).toBeGreaterThan(0);
    }
  });

  it('envuelve un fallo del renderer en RENDER_FAILED conservando la causa', async () => {
    const timeline = buildExampleTimeline('reels-9x16');
    const cause = new Error('renderMedia boom');
    const deps = createRecordingDeps({
      renderTimelineMedia: vi.fn(async () => {
        throw cause;
      }),
    });

    try {
      await renderTimeline(timeline, { outPath: 'out/broken.mp4' }, deps);
      expect.unreachable('renderTimeline debía rechazar');
    } catch (error) {
      expect(error).toBeInstanceOf(RenderTimelineError);
      expect((error as RenderTimelineError).code).toBe('RENDER_FAILED');
      expect((error as RenderTimelineError).cause).toBe(cause);
    }
  });

  it('usa remotionRenderDeps por default sin cargar los paquetes nativos de Remotion (CA-18, RNF-3)', async () => {
    const timeline = buildExampleTimeline('reels-9x16');
    const bundleProject = vi.spyOn(remotionRenderDeps, 'bundleProject').mockResolvedValue('file:///serve/');
    const selectTimelineComposition = vi
      .spyOn(remotionRenderDeps, 'selectTimelineComposition')
      .mockResolvedValue(fakeComposition());
    const renderTimelineMedia = vi
      .spyOn(remotionRenderDeps, 'renderTimelineMedia')
      .mockResolvedValue(undefined);

    const result = await renderTimeline(timeline, { outPath: 'out/default.mp4' });

    expect(bundleProject).toHaveBeenCalledTimes(1);
    expect(selectTimelineComposition).toHaveBeenCalledTimes(1);
    expect(renderTimelineMedia).toHaveBeenCalledTimes(1);
    expect(result.outPath).toBe('out/default.mp4');

    bundleProject.mockRestore();
    selectTimelineComposition.mockRestore();
    renderTimelineMedia.mockRestore();
  });
});
