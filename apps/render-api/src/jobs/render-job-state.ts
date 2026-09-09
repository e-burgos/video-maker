import type { RenderJobState } from './render-job';

export type RenderJobEvent =
  | { readonly kind: 'dispatch' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'settle'; readonly failed: boolean };

export type RenderJobTransition =
  | { readonly kind: 'moved'; readonly state: RenderJobState }
  | { readonly kind: 'rejected' };

function transitionFromQueued(event: RenderJobEvent): RenderJobTransition {
  if (event.kind === 'dispatch') {
    return { kind: 'moved', state: 'running' };
  }
  if (event.kind === 'cancel') {
    return { kind: 'moved', state: 'canceled' };
  }
  return { kind: 'rejected' };
}

function transitionFromRunning(event: RenderJobEvent): RenderJobTransition {
  if (event.kind === 'cancel') {
    return { kind: 'moved', state: 'canceling' };
  }
  if (event.kind === 'settle') {
    return { kind: 'moved', state: event.failed ? 'failed' : 'succeeded' };
  }
  return { kind: 'rejected' };
}

function transitionFromCanceling(event: RenderJobEvent): RenderJobTransition {
  if (event.kind === 'cancel') {
    return { kind: 'moved', state: 'canceling' };
  }
  if (event.kind === 'settle') {
    return { kind: 'moved', state: 'canceled' };
  }
  return { kind: 'rejected' };
}

export function applyRenderJobEvent(state: RenderJobState, event: RenderJobEvent): RenderJobTransition {
  switch (state) {
    case 'queued':
      return transitionFromQueued(event);
    case 'running':
      return transitionFromRunning(event);
    case 'canceling':
      return transitionFromCanceling(event);
    case 'succeeded':
    case 'failed':
    case 'canceled':
      return { kind: 'rejected' };
  }
}
