import { resolve } from 'node:path';
import type { Timeline, TimelineIssue } from '@video-maker/timeline-core';
import { validateTimeline } from '@video-maker/timeline-core';
import type { WebpackConfiguration } from '@remotion/bundler';
import type { VideoConfig } from 'remotion/no-react';
import { TIMELINE_COMPOSITION_ID } from './components/timeline-composition';

export const DEFAULT_RENDER_CONCURRENCY = 4;

const DEFAULT_ENTRY_POINT = resolve(__dirname, 'remotion-entry.ts');

const WORKSPACE_ALIASES: Record<string, string> = {
  '@video-maker/timeline-core': resolve(__dirname, '../../timeline-core/src/index.ts'),
};

function withWorkspaceAliases(config: WebpackConfiguration): WebpackConfiguration {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: { ...config.resolve?.alias, ...WORKSPACE_ALIASES },
    },
  };
}

export type TimelineInputProps = { timeline: Timeline };

export type CompositionMetadata = VideoConfig;

export interface RenderTimelineOptions {
  outPath: string;
  codec?: 'h264';
  concurrency?: number;
  compositionId?: string;
  entryPoint?: string;
  publicDir?: string | null;
  onProgress?: (renderedFrames: number, totalFrames: number) => void;
}

export interface RenderTimelineResult {
  outPath: string;
  compositionId: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export type RenderTimelineErrorCode =
  | 'INVALID_TIMELINE'
  | 'BUNDLE_FAILED'
  | 'COMPOSITION_NOT_FOUND'
  | 'RENDER_FAILED';

const RENDER_TIMELINE_ERROR_MESSAGES: Record<RenderTimelineErrorCode, string> = {
  INVALID_TIMELINE: 'La Timeline no pasó validateTimeline.',
  BUNDLE_FAILED: 'Remotion no pudo bundlear el entry point.',
  COMPOSITION_NOT_FOUND: 'Remotion no encontró la composición solicitada.',
  RENDER_FAILED: 'renderMedia falló durante el render.',
};

export class RenderTimelineError extends Error {
  readonly code: RenderTimelineErrorCode;
  readonly issues: readonly TimelineIssue[];

  constructor(
    code: RenderTimelineErrorCode,
    issues: readonly TimelineIssue[] = [],
    options?: { cause?: unknown },
  ) {
    super(RENDER_TIMELINE_ERROR_MESSAGES[code], options?.cause === undefined ? {} : { cause: options.cause });
    this.name = 'RenderTimelineError';
    this.code = code;
    this.issues = issues;
  }
}

export interface RenderTimelineDeps {
  bundleProject(input: { entryPoint: string; publicDir: string | null }): Promise<string>;
  selectTimelineComposition(input: {
    serveUrl: string;
    id: string;
    inputProps: TimelineInputProps;
  }): Promise<CompositionMetadata>;
  renderTimelineMedia(input: {
    composition: CompositionMetadata;
    serveUrl: string;
    codec: 'h264';
    outputLocation: string;
    concurrency: number;
    inputProps: TimelineInputProps;
    onProgress?: (renderedFrames: number, totalFrames: number) => void;
  }): Promise<void>;
}

export const remotionRenderDeps: RenderTimelineDeps = {
  async bundleProject({ entryPoint, publicDir }) {
    const { bundle } = await import('@remotion/bundler');
    return bundle({ entryPoint, webpackOverride: withWorkspaceAliases, publicDir });
  },

  async selectTimelineComposition({ serveUrl, id, inputProps }) {
    const { selectComposition } = await import('@remotion/renderer');
    return selectComposition({ serveUrl, id, inputProps });
  },

  async renderTimelineMedia({ composition, serveUrl, codec, outputLocation, concurrency, inputProps, onProgress }) {
    const { renderMedia } = await import('@remotion/renderer');
    await renderMedia({
      composition,
      serveUrl,
      codec,
      outputLocation,
      concurrency,
      inputProps,
      licenseKey: 'free-license',
      ...(onProgress === undefined
        ? {}
        : { onProgress: (progress) => onProgress(progress.renderedFrames, composition.durationInFrames) }),
    });
  },
};

async function runStage<T>(code: RenderTimelineErrorCode, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    if (cause instanceof RenderTimelineError) {
      throw cause;
    }
    throw new RenderTimelineError(code, [], { cause });
  }
}

export async function renderTimeline(
  timeline: Timeline,
  options: RenderTimelineOptions,
  deps: RenderTimelineDeps = remotionRenderDeps,
): Promise<RenderTimelineResult> {
  const validation = validateTimeline(timeline);
  if (!validation.ok) {
    throw new RenderTimelineError('INVALID_TIMELINE', validation.issues);
  }

  const entryPoint = options.entryPoint ?? DEFAULT_ENTRY_POINT;
  const publicDir = options.publicDir ?? null;
  const compositionId = options.compositionId ?? TIMELINE_COMPOSITION_ID;
  const concurrency = options.concurrency ?? DEFAULT_RENDER_CONCURRENCY;
  const codec = options.codec ?? 'h264';
  const inputProps: TimelineInputProps = { timeline };

  const serveUrl = await runStage('BUNDLE_FAILED', () => deps.bundleProject({ entryPoint, publicDir }));

  const composition = await runStage('COMPOSITION_NOT_FOUND', () =>
    deps.selectTimelineComposition({ serveUrl, id: compositionId, inputProps }),
  );

  await runStage('RENDER_FAILED', () =>
    deps.renderTimelineMedia({
      composition,
      serveUrl,
      codec,
      outputLocation: options.outPath,
      concurrency,
      inputProps,
      ...(options.onProgress === undefined ? {} : { onProgress: options.onProgress }),
    }),
  );

  return {
    outPath: options.outPath,
    compositionId,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  };
}
