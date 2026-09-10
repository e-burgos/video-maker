import { relative } from 'node:path/posix';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collapse(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function truncate(text: string): string {
  return text.length <= SUMMARY_MAX_CHARS ? text : `${text.slice(0, SUMMARY_MAX_CHARS - 1)}…`;
}

export function toProjectRelative(value: string, projectRoot: string): string {
  if (!value.startsWith(`${projectRoot}/`)) {
    return value;
  }
  const relativePath = relative(projectRoot, value);
  return relativePath === '' ? value : relativePath;
}

function queuedJobSummary(command: string): string | null {
  const createsJob = /(?:-X|--request)\s+POST/u.test(command) && /\/jobs(?:\s|'|"|$)/u.test(command);
  if (!createsJob) {
    return null;
  }
  const kind = /"kind"\s*:\s*"([a-z]+)"/u.exec(command);
  return kind === null ? 'queued render job' : `queued ${kind[1]} job`;
}

function bashSummary(command: string, projectRoot: string): string {
  const collapsed = collapse(command);
  const queued = queuedJobSummary(collapsed);
  if (queued !== null) {
    return queued;
  }

  const tokens = collapsed
    .split(' ')
    .map((token) => token.replace(/^['"]|['"]$/gu, ''))
    .filter((token) => token !== '');
  const binary = tokens[0] ?? '';
  const lastPath = [...tokens]
    .reverse()
    .find((token) => token.includes('/') && !token.startsWith('-'));

  if (binary === '' || lastPath === undefined) {
    return truncate(collapsed);
  }

  return truncate(`${toProjectRelative(binary, projectRoot)} ${toProjectRelative(lastPath, projectRoot)}`);
}

export function summarizeToolUse(name: string, input: unknown, projectRoot: string): string {
  if (!isRecord(input)) {
    return name;
  }

  if (name === 'Bash' && typeof input.command === 'string') {
    return bashSummary(input.command, projectRoot);
  }

  const target = [input.file_path, input.path, input.pattern, input.url].find(
    (value): value is string => typeof value === 'string' && value !== '',
  );

  return target === undefined ? name : truncate(`${name} ${toProjectRelative(target, projectRoot)}`);
}

function mentionsRateLimit(...values: readonly unknown[]): boolean {
  const haystack = values
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return RATE_LIMIT_MARKERS.some((marker) => haystack.includes(marker));
}

function assistantEvents(content: unknown, projectRoot: string): readonly ProducerEvent[] {
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
        summary: summarizeToolUse(block.name, block.input, projectRoot),
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

export function interpretProducerStreamLine(value: unknown, projectRoot: string): ProducerStreamSignal {
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
    const events = assistantEvents(value.message.content, projectRoot);
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
