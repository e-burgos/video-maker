import { PipelineStageError } from '../errors/pipeline-stage-error';
import { isPortableFileName } from '../store/asset-path';
import { MOTION_PHASES } from './render-job';
import type { MotionPhase } from './render-job';

export const DEFAULT_MOTION_PHASE: MotionPhase = 'all';
export const DEFAULT_MOTION_OUTPUT = 'video.mp4';
export const DEFAULT_MOTION_TAKES = 5;
export const MIN_MOTION_TAKES = 1;
export const MAX_MOTION_TAKES = 8;

export interface MotionJobInput {
  readonly phase: MotionPhase;
  readonly output: string;
  readonly takes: number;
  readonly overwrite: boolean;
}

function invalid(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'MOTION_JOB_INPUT_INVALID', stage: null, resource, expected });
}

function parsePhase(value: unknown): MotionPhase {
  if (value === undefined) {
    return DEFAULT_MOTION_PHASE;
  }
  if (typeof value !== 'string' || !(MOTION_PHASES as readonly string[]).includes(value)) {
    throw invalid('phase', MOTION_PHASES.join(', '));
  }
  return value as MotionPhase;
}

function parseOutput(value: unknown): string {
  if (value === undefined) {
    return DEFAULT_MOTION_OUTPUT;
  }
  if (typeof value !== 'string' || !isPortableFileName(value)) {
    throw invalid('output', 'a single portable file name');
  }
  return value;
}

function parseTakes(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_MOTION_TAKES;
  }
  if (!Number.isInteger(value) || (value as number) < MIN_MOTION_TAKES || (value as number) > MAX_MOTION_TAKES) {
    throw invalid('takes', `an integer between ${MIN_MOTION_TAKES} and ${MAX_MOTION_TAKES}`);
  }
  return value as number;
}

function parseOverwrite(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw invalid('overwrite', 'a boolean');
  }
  return value;
}

export function parseMotionJobInput(body: Readonly<Record<string, unknown>>): MotionJobInput {
  return {
    phase: parsePhase(body.phase),
    output: parseOutput(body.output),
    takes: parseTakes(body.takes),
    overwrite: parseOverwrite(body.overwrite),
  };
}
