import { PipelineStageError } from '../errors/pipeline-stage-error';
import type { SampleSpec } from './render-job';

export const MIN_SAMPLE_SECONDS = 8;
export const MAX_SAMPLE_SECONDS = 20;
export const SAMPLE_VIDEO_SUFFIX = '.sample.mp4';

const MP4_SUFFIX = '.mp4';

export function isSampleSpec(value: unknown): value is SampleSpec {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).seconds === 'number' &&
    Number.isFinite((value as SampleSpec).seconds) &&
    (value as SampleSpec).seconds >= MIN_SAMPLE_SECONDS &&
    (value as SampleSpec).seconds <= MAX_SAMPLE_SECONDS
  );
}

export function parseSampleInput(value: unknown): SampleSpec | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isSampleSpec(value)) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'sample',
      expected: `{ "seconds": a number from ${String(MIN_SAMPLE_SECONDS)} to ${String(MAX_SAMPLE_SECONDS)} }`,
    });
  }
  return { seconds: value.seconds };
}

export function isSampleVideoName(fileName: string): boolean {
  return fileName.endsWith(SAMPLE_VIDEO_SUFFIX);
}

export function sampleOutputName(output: string): string {
  const stem = output.endsWith(MP4_SUFFIX) ? output.slice(0, -MP4_SUFFIX.length) : output;
  return `${stem}${SAMPLE_VIDEO_SUFFIX}`;
}
