import { workPath } from '@video-maker/auto-montage';

export const PRODUCER_DIRECTORY_NAME = 'producer';
export const PRODUCER_CONVERSATION_FILE_NAME = 'conversation.json';
export const PRODUCER_CONVERSATION_MARKDOWN_FILE_NAME = 'conversation.md';
export const PRODUCER_SESSION_FILE_NAME = 'session.json';
export const PRODUCER_TURNS_DIRECTORY_NAME = 'turns';

export function producerDirectoryPath(): string {
  return workPath(PRODUCER_DIRECTORY_NAME);
}

export function producerConversationPath(): string {
  return workPath(PRODUCER_DIRECTORY_NAME, PRODUCER_CONVERSATION_FILE_NAME);
}

export function producerConversationMarkdownPath(): string {
  return workPath(PRODUCER_DIRECTORY_NAME, PRODUCER_CONVERSATION_MARKDOWN_FILE_NAME);
}

export function producerSessionPath(): string {
  return workPath(PRODUCER_DIRECTORY_NAME, PRODUCER_SESSION_FILE_NAME);
}

export function producerTurnsDirectoryPath(): string {
  return workPath(PRODUCER_DIRECTORY_NAME, PRODUCER_TURNS_DIRECTORY_NAME);
}

export function producerTurnLogPath(turnId: string): string {
  return workPath(PRODUCER_DIRECTORY_NAME, PRODUCER_TURNS_DIRECTORY_NAME, `${turnId}.jsonl`);
}
