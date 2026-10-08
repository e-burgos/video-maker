import type { ProducerRuntimeMessage } from '@video-maker/producer-tools';

const MISSING_SESSION_MESSAGE = 'No conversation found with session ID';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function reportsMissingProducerSession(line: unknown): boolean {
  if (!isRecord(line) || line.type !== 'result' || !Array.isArray(line.errors)) {
    return false;
  }
  return line.errors.some((error) => typeof error === 'string' && error.includes(MISSING_SESSION_MESSAGE));
}

function withoutPendingUserMessage(
  history: readonly ProducerRuntimeMessage[],
  text: string,
): readonly ProducerRuntimeMessage[] {
  const last = history[history.length - 1];
  return last !== undefined && last.role === 'user' && last.content === text ? history.slice(0, -1) : history;
}

export function messageWithRecoveredHistory(history: readonly ProducerRuntimeMessage[], text: string): string {
  const previous = withoutPendingUserMessage(history, text);
  if (previous.length === 0) {
    return text;
  }
  const transcript = previous
    .map((message) => `${message.role === 'user' ? 'Usuario' : 'Productor'}: ${message.content}`)
    .join('\n\n');
  return [
    'The previous session of this conversation is no longer available. This is the conversation so far:',
    transcript,
    'New message from the user:',
    text,
  ].join('\n\n');
}
