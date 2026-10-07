import { MotionStudioError } from '@video-maker/motion-graphics';
import { describe, expect, it } from 'vitest';

import { PipelineStageError } from './pipeline-stage-error';
import { translateMotionError } from './translate-motion-error';

describe('translateMotionError', () => {
  it.each([
    ['BRIEF_INVALID', 'BRIEF_INVALID'],
    ['STORYBOARD_INVALID', 'STORYBOARD_INVALID'],
    ['AI_FAILED', 'AI_AGENT_FAILED'],
    ['ASSET_MISSING', 'FILE_NOT_FOUND'],
    ['BRAND_INVALID', 'SERVER_CONFIG_INVALID'],
    ['STAGE_FAILED', 'MOTION_PIPELINE_FAILED'],
  ] as const)('maps %s to %s keeping the message as expected', (motionCode, apiCode) => {
    const translated = translateMotionError(new MotionStudioError(motionCode, 'boom'), 'plan', 'x');

    expect(translated).toMatchObject({ code: apiCode, stage: 'plan', expected: 'boom', resource: 'x' });
  });

  it('surfaces the agent error that caused AI_FAILED with its own code and provider details', () => {
    const agentError = new PipelineStageError({ code: 'AI_AGENT_RATE_LIMITED', stage: null, resource: 'ai-agent', details: { subtype: 'error_during_execution', result: 'limit' } });
    const translated = translateMotionError(new MotionStudioError('AI_FAILED', 'the agent failed', { cause: agentError }), 'storyboard', null);

    expect(translated).toMatchObject({ code: 'AI_AGENT_RATE_LIMITED', stage: 'storyboard', resource: 'ai-agent', details: { subtype: 'error_during_execution', result: 'limit' } });
  });

  it('answers null for anything that is not a MotionStudioError', () => {
    expect(translateMotionError(new Error('x'), null, null)).toBeNull();
  });
});
