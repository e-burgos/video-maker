import { describe, expect, it } from 'vitest';

import {
  producerConversationMarkdownPath,
  producerConversationPath,
  producerDirectoryPath,
  producerSessionPath,
  producerTurnLogPath,
  producerTurnsDirectoryPath,
} from './producer-paths';

describe('producer paths', () => {
  it('viven todos bajo work/producer/, junto al plan y al guion escritos a mano', () => {
    expect(producerDirectoryPath()).toBe('work/producer');
    expect(producerConversationPath()).toBe('work/producer/conversation.json');
    expect(producerConversationMarkdownPath()).toBe('work/producer/conversation.md');
    expect(producerSessionPath()).toBe('work/producer/session.json');
    expect(producerTurnsDirectoryPath()).toBe('work/producer/turns');
  });

  it('da un jsonl por turno, nombrado por el turnId', () => {
    expect(producerTurnLogPath('turn-0001')).toBe('work/producer/turns/turn-0001.jsonl');
  });
});
