import { describe, expect, it } from 'vitest';
import type { ZodObject } from 'zod';

import { STUDIO_TOOL_NAMES } from './tool-names';
import {
  MAX_EXTRACT_FRAMES_AT_SECONDS,
  MAX_SEARCH_FREE_MUSIC_RESULTS,
  MAX_WAIT_FOR_JOB_TIMEOUT_SECONDS,
  MIN_EXTRACT_FRAMES_AT_SECONDS,
  MIN_SEARCH_FREE_MUSIC_RESULTS,
  MIN_WAIT_FOR_JOB_TIMEOUT_SECONDS,
  ProjectRelativePathSchema,
  STUDIO_TOOLS,
  StartJobInputSchema,
} from './tool-schemas';

const EXPECTED_OUTPUT_FIELDS: Record<(typeof STUDIO_TOOL_NAMES)[number], readonly string[]> = {
  get_project_overview: ['slug', 'title', 'assets', 'hasTimeline', 'script', 'recentJobs'],
  probe_media: ['path', 'durationMs', 'video', 'audio'],
  extract_frames: ['frames'],
  list_voices: ['voices', 'defaultVoiceId'],
  read_project_text: ['path', 'content'],
  write_project_text: ['path', 'bytes'],
  copy_asset: ['path'],
  start_job: ['jobId', 'kind', 'status'],
  wait_for_job: ['jobId', 'kind', 'status', 'progress', 'result', 'error'],
  cancel_job: ['jobId', 'status'],
  get_timeline: ['timeline'],
  put_timeline: ['saved'],
  search_free_music: ['results'],
  import_music: ['path', 'credit'],
};

describe('STUDIO_TOOLS', () => {
  it('defines exactly the tools frozen in the plan, no more, no less', () => {
    expect(Object.keys(STUDIO_TOOLS).sort()).toEqual([...STUDIO_TOOL_NAMES].sort());
  });

  it.each(STUDIO_TOOL_NAMES)('has an input schema, an output schema and a description for %s', (name) => {
    const tool = STUDIO_TOOLS[name];
    expect(tool.description.length).toBeGreaterThan(0);
    expect(tool.input).toBeDefined();
    expect(tool.output).toBeDefined();
  });

  it.each(Object.entries(EXPECTED_OUTPUT_FIELDS))('output of %s exposes exactly the plan fields', (name, fields) => {
    const tool = STUDIO_TOOLS[name as (typeof STUDIO_TOOL_NAMES)[number]];
    const shape = (tool.output as ZodObject).shape;
    expect(Object.keys(shape).sort()).toEqual([...fields].sort());
  });
});

describe('ProjectRelativePathSchema', () => {
  it('accepts a project-relative path', () => {
    expect(ProjectRelativePathSchema.safeParse('raw/aroll/clip01.mp4').success).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(ProjectRelativePathSchema.safeParse('').success).toBe(false);
  });

  it('rejects a blank string', () => {
    expect(ProjectRelativePathSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects a unix absolute path', () => {
    expect(ProjectRelativePathSchema.safeParse('/etc/passwd').success).toBe(false);
  });

  it('rejects a windows absolute path', () => {
    expect(ProjectRelativePathSchema.safeParse('C:\\Users\\x').success).toBe(false);
  });

  it('rejects a path with backslashes', () => {
    expect(ProjectRelativePathSchema.safeParse('raw\\aroll\\clip01.mp4').success).toBe(false);
  });

  it('rejects a path with a ".." segment', () => {
    expect(ProjectRelativePathSchema.safeParse('raw/../etc/passwd').success).toBe(false);
  });

  it('rejects a path that is only ".."', () => {
    expect(ProjectRelativePathSchema.safeParse('..').success).toBe(false);
  });
});

describe('StartJobInputSchema', () => {
  it('accepts a bare render job', () => {
    expect(StartJobInputSchema.safeParse({ kind: 'render' }).success).toBe(true);
  });

  it('rejects a render job with unknown fields', () => {
    expect(StartJobInputSchema.safeParse({ kind: 'render', preset: 'hardware' }).success).toBe(false);
  });

  it('accepts a minimal montage job', () => {
    expect(StartJobInputSchema.safeParse({ kind: 'montage' }).success).toBe(true);
  });

  it('accepts a full montage job', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'montage',
      preset: 'hardware',
      seed: 7,
      overwrite: true,
      scriptText: 'Hello world',
      logo: 'off',
      format: 'youtube-16x9',
      voice: 'script',
      captionStyle: 'bold-impact',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a montage job with both scriptPath and scriptText', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'montage',
      scriptPath: 'work/script.txt',
      scriptText: 'Hello world',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a storyboard job with neither brief nor scriptText', () => {
    expect(StartJobInputSchema.safeParse({ kind: 'storyboard' }).success).toBe(false);
  });

  it('rejects a storyboard job with both brief and scriptText', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'storyboard',
      brief: 'A product ad',
      scriptText: 'Hello world',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a storyboard job with only a brief', () => {
    expect(StartJobInputSchema.safeParse({ kind: 'storyboard', brief: 'A product ad' }).success).toBe(true);
  });

  it('accepts a minimal voice job', () => {
    expect(StartJobInputSchema.safeParse({ kind: 'voice' }).success).toBe(true);
  });

  it('rejects a voice job with both scriptText and scriptPath', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'voice',
      scriptText: 'Hello world',
      scriptPath: 'work/script.txt',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a voice job with sceneIds and a script together', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'voice',
      scriptText: 'Hello world',
      sceneIds: ['scene-1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a voice job with gapMs but no script', () => {
    expect(StartJobInputSchema.safeParse({ kind: 'voice', gapMs: 500 }).success).toBe(false);
  });

  it('accepts a voice job with a script and a gapMs', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'voice',
      scriptText: 'Hello world',
      gapMs: 500,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a photo-aroll job', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'photo-aroll',
      photos: ['raw/images/1.jpg', 'raw/images/2.jpg'],
      output: 'aroll-01.mp4',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a photo-aroll job with the default fps', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'photo-aroll',
      photos: ['raw/images/1.jpg'],
      output: 'aroll-01.mp4',
      fps: 30,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a photo-aroll job with an fps other than 30', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'photo-aroll',
      photos: ['raw/images/1.jpg'],
      output: 'aroll-01.mp4',
      fps: 24,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a photo-aroll job with no photos', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'photo-aroll',
      photos: [],
      output: 'aroll-01.mp4',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a photo-aroll job with an absolute photo path', () => {
    const result = StartJobInputSchema.safeParse({
      kind: 'photo-aroll',
      photos: ['/etc/passwd'],
      output: 'aroll-01.mp4',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown job kind', () => {
    expect(StartJobInputSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
  });
});

describe('STUDIO_TOOLS.start_job.input', () => {
  it('accepts the union wrapped under "job"', () => {
    expect(STUDIO_TOOLS.start_job.input.safeParse({ job: { kind: 'render' } }).success).toBe(true);
  });

  it('rejects the union unwrapped at the root', () => {
    expect(STUDIO_TOOLS.start_job.input.safeParse({ kind: 'render' }).success).toBe(false);
  });

  it('rejects fields other than "job"', () => {
    expect(STUDIO_TOOLS.start_job.input.safeParse({ job: { kind: 'render' }, extra: true }).success).toBe(false);
  });
});

describe('bounds from the plan', () => {
  it('accepts atSeconds at the lower and upper bound', () => {
    const { extract_frames } = STUDIO_TOOLS;
    const lower = Array.from({ length: MIN_EXTRACT_FRAMES_AT_SECONDS }, (_, index) => index);
    const upper = Array.from({ length: MAX_EXTRACT_FRAMES_AT_SECONDS }, (_, index) => index);
    expect(extract_frames.input.safeParse({ path: 'raw/aroll/clip01.mp4', atSeconds: lower }).success).toBe(true);
    expect(extract_frames.input.safeParse({ path: 'raw/aroll/clip01.mp4', atSeconds: upper }).success).toBe(true);
  });

  it('rejects atSeconds with zero or too many entries', () => {
    const { extract_frames } = STUDIO_TOOLS;
    const tooMany = Array.from({ length: MAX_EXTRACT_FRAMES_AT_SECONDS + 1 }, (_, index) => index);
    expect(extract_frames.input.safeParse({ path: 'raw/aroll/clip01.mp4', atSeconds: [] }).success).toBe(false);
    expect(extract_frames.input.safeParse({ path: 'raw/aroll/clip01.mp4', atSeconds: tooMany }).success).toBe(false);
  });

  it('accepts timeoutSeconds at the lower and upper bound', () => {
    const { wait_for_job } = STUDIO_TOOLS;
    expect(wait_for_job.input.safeParse({ jobId: 'job-1', timeoutSeconds: MIN_WAIT_FOR_JOB_TIMEOUT_SECONDS }).success).toBe(true);
    expect(wait_for_job.input.safeParse({ jobId: 'job-1', timeoutSeconds: MAX_WAIT_FOR_JOB_TIMEOUT_SECONDS }).success).toBe(true);
  });

  it('rejects timeoutSeconds outside the bounds', () => {
    const { wait_for_job } = STUDIO_TOOLS;
    expect(wait_for_job.input.safeParse({ jobId: 'job-1', timeoutSeconds: MIN_WAIT_FOR_JOB_TIMEOUT_SECONDS - 1 }).success).toBe(false);
    expect(wait_for_job.input.safeParse({ jobId: 'job-1', timeoutSeconds: MAX_WAIT_FOR_JOB_TIMEOUT_SECONDS + 1 }).success).toBe(false);
  });

  it('accepts maxResults at the lower and upper bound', () => {
    const { search_free_music } = STUDIO_TOOLS;
    expect(search_free_music.input.safeParse({ mood: 'upbeat', maxResults: MIN_SEARCH_FREE_MUSIC_RESULTS }).success).toBe(true);
    expect(search_free_music.input.safeParse({ mood: 'upbeat', maxResults: MAX_SEARCH_FREE_MUSIC_RESULTS }).success).toBe(true);
  });

  it('rejects maxResults outside the bounds', () => {
    const { search_free_music } = STUDIO_TOOLS;
    expect(search_free_music.input.safeParse({ mood: 'upbeat', maxResults: MIN_SEARCH_FREE_MUSIC_RESULTS - 1 }).success).toBe(false);
    expect(search_free_music.input.safeParse({ mood: 'upbeat', maxResults: MAX_SEARCH_FREE_MUSIC_RESULTS + 1 }).success).toBe(false);
  });
});
