import type { StateBadgeTone } from '@e-burgos/tucu-ui';

import type { RenderJobState } from './render-api-types';

export const INTERRUPTED_JOB_CODE = 'JOB_INTERRUPTED';

export const RENDER_JOB_STATE_TONE: Readonly<Record<RenderJobState, StateBadgeTone>> = {
  queued: 'neutral',
  running: 'purple',
  canceling: 'orange',
  succeeded: 'green',
  failed: 'red',
  canceled: 'neutral',
};

export function renderJobTone(state: RenderJobState, errorCode: string | null): StateBadgeTone {
  return state === 'failed' && errorCode === INTERRUPTED_JOB_CODE ? 'orange' : RENDER_JOB_STATE_TONE[state];
}
