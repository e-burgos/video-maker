import type { Timeline } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { RenderApiErrorPayload } from '../errors/render-api-error';
import { toErrorPayload } from '../errors/to-error-payload';
import type { RenderPipelineObserver } from '../pipeline/render-pipeline-observer';
import { isRenderPipelineCanceled } from '../pipeline/render-pipeline-observer';
import type { RenderPipelineReport } from '../pipeline/run-render-pipeline';
import { runRenderPipeline } from '../pipeline/run-render-pipeline';
import { mergeRenderProgress, startRenderJobStage } from './render-job-progress';
import { applyRenderJobEvent } from './render-job-state';
import type { RenderJob, RenderJobProgress, RenderJobState } from './render-job';
import { toRenderJob } from './render-job';

export interface CreateRenderJobInput {
  readonly slug: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
}

export type CancelRenderJobResult =
  | { readonly kind: 'canceled'; readonly job: RenderJob }
  | { readonly kind: 'canceling'; readonly job: RenderJob }
  | { readonly kind: 'not-cancelable'; readonly job: RenderJob }
  | { readonly kind: 'not-found' };

export interface RenderJobQueueSize {
  readonly running: number;
  readonly queued: number;
}

export interface RenderJobQueue {
  readonly create: (input: CreateRenderJobInput) => RenderJob;
  readonly get: (jobId: string) => RenderJob | null;
  readonly listBySlug: (slug: string) => readonly RenderJob[];
  readonly cancel: (jobId: string) => CancelRenderJobResult;
  readonly size: () => RenderJobQueueSize;
  readonly whenIdle: () => Promise<void>;
}

interface RenderJobRecord {
  readonly id: string;
  readonly slug: string;
  readonly projectRoot: string;
  readonly timeline: Timeline;
  readonly createdAt: string;
  state: RenderJobState;
  startedAt: string | null;
  finishedAt: string | null;
  progress: RenderJobProgress | null;
  report: RenderPipelineReport | null;
  error: RenderApiErrorPayload | null;
}

export function createRenderJobQueue(deps: RenderApiDependencies): RenderJobQueue {
  const records = new Map<string, RenderJobRecord>();
  const pending: string[] = [];
  const idleResolvers: Array<() => void> = [];
  let activeId: string | null = null;

  function logTransition(record: RenderJobRecord, from: RenderJobState, to: RenderJobState): void {
    deps.logger.info({
      event: 'render-job-transition',
      detail: { jobId: record.id, slug: record.slug, from, to },
    });
  }

  function resolveIdle(): void {
    const resolvers = idleResolvers.splice(0, idleResolvers.length);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  function settle(
    record: RenderJobRecord,
    report: RenderPipelineReport | null,
    failure: RenderApiErrorPayload | null,
  ): void {
    const from = record.state;
    const transition = applyRenderJobEvent(from, { kind: 'settle', failed: failure !== null });

    if (transition.kind === 'rejected') {
      return;
    }

    record.state = transition.state;
    record.report = transition.state === 'succeeded' ? report : null;
    record.error = transition.state === 'failed' ? failure : null;
    record.finishedAt = deps.clock.nowIso();
    logTransition(record, from, record.state);
  }

  async function runJob(record: RenderJobRecord): Promise<void> {
    const observer: RenderPipelineObserver = {
      stageStarted: (stage) => {
        record.progress = startRenderJobStage(record.progress, stage);
      },
      renderProgressed: (renderedFrames, totalFrames) => {
        record.progress = mergeRenderProgress(record.progress, renderedFrames, totalFrames);
      },
      cancellationRequested: () => record.state === 'canceling',
    };

    let report: RenderPipelineReport | null = null;
    let failure: RenderApiErrorPayload | null = null;

    try {
      report = await runRenderPipeline(
        { renderId: record.id, projectRoot: record.projectRoot, timeline: record.timeline },
        deps,
        observer,
      );
    } catch (cause) {
      failure = isRenderPipelineCanceled(cause) ? null : toErrorPayload(cause);
    }

    settle(record, report, failure);
    activeId = null;
    dispatchNext();
  }

  function dispatchNext(): void {
    if (activeId !== null) {
      return;
    }

    let nextId = pending.shift();
    while (nextId !== undefined) {
      const record = records.get(nextId);
      if (record === undefined) {
        nextId = pending.shift();
        continue;
      }

      const transition = applyRenderJobEvent(record.state, { kind: 'dispatch' });
      if (transition.kind === 'rejected') {
        nextId = pending.shift();
        continue;
      }

      const previousState = record.state;
      record.state = transition.state;
      record.startedAt = deps.clock.nowIso();
      activeId = record.id;
      logTransition(record, previousState, record.state);
      void runJob(record);
      return;
    }

    resolveIdle();
  }

  function create(input: CreateRenderJobInput): RenderJob {
    const id = deps.randomId();
    const record: RenderJobRecord = {
      id,
      slug: input.slug,
      projectRoot: input.projectRoot,
      timeline: input.timeline,
      createdAt: deps.clock.nowIso(),
      state: 'queued',
      startedAt: null,
      finishedAt: null,
      progress: null,
      report: null,
      error: null,
    };

    records.set(id, record);
    pending.push(id);
    dispatchNext();

    return toRenderJob(record);
  }

  function get(jobId: string): RenderJob | null {
    const record = records.get(jobId);
    return record === undefined ? null : toRenderJob(record);
  }

  function listBySlug(slug: string): readonly RenderJob[] {
    const jobs: RenderJob[] = [];
    for (const record of records.values()) {
      if (record.slug === slug) {
        jobs.push(toRenderJob(record));
      }
    }
    return jobs;
  }

  function cancel(jobId: string): CancelRenderJobResult {
    const record = records.get(jobId);
    if (record === undefined) {
      return { kind: 'not-found' };
    }

    const previousState = record.state;
    const transition = applyRenderJobEvent(previousState, { kind: 'cancel' });

    if (transition.kind === 'rejected') {
      return { kind: 'not-cancelable', job: toRenderJob(record) };
    }

    if (previousState === transition.state) {
      return { kind: 'canceling', job: toRenderJob(record) };
    }

    record.state = transition.state;

    if (previousState === 'queued') {
      const index = pending.indexOf(jobId);
      if (index !== -1) {
        pending.splice(index, 1);
      }
      record.finishedAt = deps.clock.nowIso();
    }

    logTransition(record, previousState, record.state);

    return {
      kind: transition.state === 'canceled' ? 'canceled' : 'canceling',
      job: toRenderJob(record),
    };
  }

  function size(): RenderJobQueueSize {
    return { running: activeId === null ? 0 : 1, queued: pending.length };
  }

  function whenIdle(): Promise<void> {
    if (activeId === null && pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      idleResolvers.push(resolve);
    });
  }

  return { create, get, listBySlug, cancel, size, whenIdle };
}
