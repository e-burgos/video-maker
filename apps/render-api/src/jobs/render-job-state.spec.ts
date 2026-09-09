import { describe, expect, it } from 'vitest';

import { isTerminalRenderJobState } from './render-job';
import type { RenderJobState } from './render-job';
import { applyRenderJobEvent } from './render-job-state';
import type { RenderJobEvent } from './render-job-state';

interface LegalTransitionCase {
  readonly title: string;
  readonly from: RenderJobState;
  readonly event: RenderJobEvent;
  readonly to: RenderJobState;
}

const LEGAL_TRANSITIONS: readonly LegalTransitionCase[] = [
  { title: 'moves queued to running on dispatch', from: 'queued', event: { kind: 'dispatch' }, to: 'running' },
  { title: 'moves queued to canceled on cancel', from: 'queued', event: { kind: 'cancel' }, to: 'canceled' },
  { title: 'moves running to canceling on cancel', from: 'running', event: { kind: 'cancel' }, to: 'canceling' },
  {
    title: 'moves running to succeeded on settle{failed:false}',
    from: 'running',
    event: { kind: 'settle', failed: false },
    to: 'succeeded',
  },
  {
    title: 'moves running to failed on settle{failed:true}',
    from: 'running',
    event: { kind: 'settle', failed: true },
    to: 'failed',
  },
  {
    title: 'moves canceling to canceled on settle{failed:false}',
    from: 'canceling',
    event: { kind: 'settle', failed: false },
    to: 'canceled',
  },
  {
    title: 'moves canceling to canceled on settle{failed:true}',
    from: 'canceling',
    event: { kind: 'settle', failed: true },
    to: 'canceled',
  },
  {
    title: 'keeps canceling on the idempotent cancel',
    from: 'canceling',
    event: { kind: 'cancel' },
    to: 'canceling',
  },
];

interface IllegalTransitionCase {
  readonly title: string;
  readonly from: RenderJobState;
  readonly event: RenderJobEvent;
}

function terminalRejections(from: RenderJobState): readonly IllegalTransitionCase[] {
  return [
    { title: `rejects dispatch from ${from}`, from, event: { kind: 'dispatch' } },
    { title: `rejects cancel from ${from}`, from, event: { kind: 'cancel' } },
    { title: `rejects settle{failed:false} from ${from}`, from, event: { kind: 'settle', failed: false } },
    { title: `rejects settle{failed:true} from ${from}`, from, event: { kind: 'settle', failed: true } },
  ];
}

const ILLEGAL_TRANSITIONS: readonly IllegalTransitionCase[] = [
  { title: 'rejects settle{failed:false} from queued', from: 'queued', event: { kind: 'settle', failed: false } },
  { title: 'rejects settle{failed:true} from queued', from: 'queued', event: { kind: 'settle', failed: true } },
  { title: 'rejects dispatch from running', from: 'running', event: { kind: 'dispatch' } },
  { title: 'rejects dispatch from canceling', from: 'canceling', event: { kind: 'dispatch' } },
  ...terminalRejections('succeeded'),
  ...terminalRejections('failed'),
  ...terminalRejections('canceled'),
];

describe('applyRenderJobEvent', () => {
  it.each(LEGAL_TRANSITIONS)('$title', ({ from, event, to }) => {
    expect(applyRenderJobEvent(from, event)).toEqual({ kind: 'moved', state: to });
  });

  it.each(ILLEGAL_TRANSITIONS)('$title', ({ from, event }) => {
    expect(applyRenderJobEvent(from, event)).toEqual({ kind: 'rejected' });
  });
});

describe('isTerminalRenderJobState', () => {
  it('reports the three terminal states and only those', () => {
    expect(isTerminalRenderJobState('queued')).toBe(false);
    expect(isTerminalRenderJobState('running')).toBe(false);
    expect(isTerminalRenderJobState('canceling')).toBe(false);
    expect(isTerminalRenderJobState('succeeded')).toBe(true);
    expect(isTerminalRenderJobState('failed')).toBe(true);
    expect(isTerminalRenderJobState('canceled')).toBe(true);
  });
});
