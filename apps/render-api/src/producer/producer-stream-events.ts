import { claudeCodeToolName, isStudioToolName } from '@video-maker/producer-tools';
import type { StudioToolName } from '@video-maker/producer-tools';

export const PRODUCER_EVENT_TYPES = ['text', 'tool', 'status'] as const;

export type ProducerEventType = (typeof PRODUCER_EVENT_TYPES)[number];

export interface ProducerTextEvent {
  readonly type: 'text';
  readonly text: string;
}

export interface ProducerToolEvent {
  readonly type: 'tool';
  readonly name: string;
  readonly summary: string;
}

export interface ProducerStatusEvent {
  readonly type: 'status';
  readonly status: string;
}

export type ProducerEvent = ProducerTextEvent | ProducerToolEvent | ProducerStatusEvent;

export type ProducerStreamSignal =
  | { readonly kind: 'ignored' }
  | { readonly kind: 'session'; readonly sessionId: string; readonly events: readonly ProducerEvent[] }
  | { readonly kind: 'events'; readonly events: readonly ProducerEvent[] }
  | {
      readonly kind: 'result';
      readonly ok: boolean;
      readonly text: string;
      readonly rateLimited: boolean;
    };

const RATE_LIMIT_MARKERS = ['rate limit', 'rate_limit', 'usage limit', 'quota', '429'] as const;

const SUMMARY_MAX_CHARS = 140;

const STUDIO_TOOL_PREFIX = 'mcp__studio__';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collapse(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function truncate(text: string): string {
  return text.length <= SUMMARY_MAX_CHARS ? text : `${text.slice(0, SUMMARY_MAX_CHARS - 1)}…`;
}

function stringField(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function pluralize(count: number, word: string): string {
  return count === 1 ? `1 ${word}` : `${count} ${word}s`;
}

function studioToolNameOf(name: string): StudioToolName | null {
  if (!name.startsWith(STUDIO_TOOL_PREFIX)) {
    return null;
  }
  const candidate = name.slice(STUDIO_TOOL_PREFIX.length);
  return isStudioToolName(candidate) && claudeCodeToolName(candidate) === name ? candidate : null;
}

function summarizeStudioTool(tool: StudioToolName, input: Record<string, unknown>): string {
  switch (tool) {
    case 'get_project_overview':
      return 'Checking the project';
    case 'probe_media':
      return truncate(`Measuring ${stringField(input, 'path') ?? 'the media'}`);
    case 'extract_frames': {
      const atSeconds = input.atSeconds;
      const frameCount = Array.isArray(atSeconds) ? atSeconds.length : 1;
      return truncate(`Looking at ${pluralize(frameCount, 'frame')} of ${stringField(input, 'path') ?? 'the video'}`);
    }
    case 'list_voices':
      return 'Listing available voices';
    case 'read_project_text':
      return truncate(`Reading ${stringField(input, 'path') ?? 'a file'}`);
    case 'write_project_text':
      return truncate(`Writing ${stringField(input, 'path') ?? 'a file'}`);
    case 'copy_asset': {
      const role = stringField(input, 'role') ?? 'raw';
      return truncate(`Copying ${stringField(input, 'from') ?? 'the file'} into raw/${role}/`);
    }
    case 'start_job': {
      const job = isRecord(input.job) ? input.job : {};
      return truncate(`Starting the ${stringField(job, 'kind') ?? 'render'} job`);
    }
    case 'wait_for_job':
      return truncate(`Waiting for job ${stringField(input, 'jobId') ?? ''}`.trim());
    case 'cancel_job':
      return truncate(`Canceling job ${stringField(input, 'jobId') ?? ''}`.trim());
    case 'get_timeline':
      return 'Checking the timeline';
    case 'put_timeline':
      return 'Saving the timeline';
    case 'patch_timeline': {
      const sections = (['logo', 'bumpers', 'audioMix', 'captionStyle', 'safeZone', 'music'] as const).filter(
        (key) => input[key] !== undefined,
      );
      return truncate(`Updating ${sections.join(', ') || 'the timeline'}`);
    }
    case 'search_free_music':
      return truncate(`Searching free music: ${stringField(input, 'mood') ?? ''}`.trim());
    case 'import_music':
      return 'Importing music';
    case 'search_free_media':
      return truncate(`Searching free media: ${stringField(input, 'query') ?? ''}`.trim());
    case 'import_media':
      return 'Importing free media';
    case 'view_images': {
      const paths = input.paths;
      const pathCount = Array.isArray(paths) ? paths.length : 1;
      return truncate(`Looking at ${pluralize(pathCount, 'photo')}`);
    }
    case 'get_motion_brands':
      return 'Listing the available brands';
    case 'read_motion_brief':
      return 'Reading the motion brief';
    case 'write_motion_brief':
      return 'Saving the motion brief';
    case 'read_motion_storyboard':
      return 'Reading the motion storyboard';
    case 'write_motion_storyboard':
      return 'Saving the motion storyboard';
  }
}

export function summarizeToolUse(name: string, input: unknown): string {
  const tool = studioToolNameOf(name);
  if (tool === null) {
    return name;
  }
  return summarizeStudioTool(tool, isRecord(input) ? input : {});
}

function mentionsRateLimit(...values: readonly unknown[]): boolean {
  const haystack = values
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return RATE_LIMIT_MARKERS.some((marker) => haystack.includes(marker));
}

function assistantEvents(content: unknown): readonly ProducerEvent[] {
  if (!Array.isArray(content)) {
    return [];
  }

  const events: ProducerEvent[] = [];
  for (const block of content) {
    if (!isRecord(block)) {
      continue;
    }
    if (block.type === 'text' && typeof block.text === 'string' && collapse(block.text) !== '') {
      events.push({ type: 'text', text: block.text });
      continue;
    }
    if (block.type === 'tool_use' && typeof block.name === 'string') {
      events.push({
        type: 'tool',
        name: block.name,
        summary: summarizeToolUse(block.name, block.input),
      });
    }
  }
  return events;
}

function toolResultEvents(content: unknown): readonly ProducerEvent[] {
  if (!Array.isArray(content)) {
    return [];
  }
  return content.some((block) => isRecord(block) && block.type === 'tool_result' && block.is_error === true)
    ? [{ type: 'status', status: 'tool-failed' }]
    : [];
}

export function interpretProducerStreamLine(value: unknown): ProducerStreamSignal {
  if (!isRecord(value)) {
    return { kind: 'ignored' };
  }

  if (value.type === 'system' && value.subtype === 'init' && typeof value.session_id === 'string') {
    return {
      kind: 'session',
      sessionId: value.session_id,
      events: [{ type: 'status', status: 'started' }],
    };
  }

  if (value.type === 'assistant' && isRecord(value.message)) {
    const events = assistantEvents(value.message.content);
    return events.length === 0 ? { kind: 'ignored' } : { kind: 'events', events };
  }

  if (value.type === 'user' && isRecord(value.message)) {
    const events = toolResultEvents(value.message.content);
    return events.length === 0 ? { kind: 'ignored' } : { kind: 'events', events };
  }

  if (value.type === 'result') {
    const text = typeof value.result === 'string' ? value.result : '';
    return {
      kind: 'result',
      ok: value.is_error !== true && value.subtype === 'success',
      text,
      rateLimited: mentionsRateLimit(value.subtype, value.result),
    };
  }

  return { kind: 'ignored' };
}
