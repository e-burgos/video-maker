import type { MediaProject } from '@video-maker/auto-montage';
import type { ProducerRuntimeMessage } from '@video-maker/producer-tools';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import type { ProducerMessage } from './producer-documents';
import { readProducerConversation } from './producer-store';
import type { ProducerTurnRegistry } from './producer-turn-registry';

export const DEFAULT_PRODUCER_HISTORY_CHAR_BUDGET = 16_000;

export interface BuildProducerHistoryOptions {
  readonly charBudget?: number;
}

function toolSummaryLine(registry: ProducerTurnRegistry, turnId: string | undefined): string | null {
  if (turnId === undefined) {
    return null;
  }
  let record;
  try {
    record = registry.get(turnId);
  } catch {
    return null;
  }
  const toolNames = record.events.filter((event) => event.type === 'tool').map((event) => event.name);
  if (toolNames.length === 0) {
    return null;
  }
  return `[Tools used: ${toolNames.join(', ')}]`;
}

function toRuntimeMessage(message: ProducerMessage, registry: ProducerTurnRegistry): ProducerRuntimeMessage {
  if (message.role === 'assistant') {
    const summary = toolSummaryLine(registry, message.turnId);
    return { role: 'assistant', content: summary === null ? message.text : `${summary}\n${message.text}` };
  }
  return { role: 'user', content: message.text };
}

function groupIntoExchanges(messages: readonly ProducerMessage[]): readonly (readonly ProducerMessage[])[] {
  const exchanges: ProducerMessage[][] = [];
  let current: ProducerMessage[] = [];
  for (const message of messages) {
    if (message.role === 'user' && current.length > 0) {
      exchanges.push(current);
      current = [];
    }
    current.push(message);
  }
  if (current.length > 0) {
    exchanges.push(current);
  }
  return exchanges;
}

export function buildProducerHistory(
  deps: RenderApiDependencies,
  project: MediaProject,
  registry: ProducerTurnRegistry,
  options: BuildProducerHistoryOptions = {},
): readonly ProducerRuntimeMessage[] {
  const budget = options.charBudget ?? DEFAULT_PRODUCER_HISTORY_CHAR_BUDGET;
  const conversation = readProducerConversation(deps, project);
  const exchanges = groupIntoExchanges(conversation).map((exchange) =>
    exchange.map((message) => toRuntimeMessage(message, registry)),
  );

  const kept: ProducerRuntimeMessage[][] = [];
  let usedChars = 0;
  let firstKeptIndex = exchanges.length;

  for (let index = exchanges.length - 1; index >= 0; index -= 1) {
    const runtimeMessages = exchanges[index] ?? [];
    const length = runtimeMessages.reduce((sum, message) => sum + message.content.length, 0);
    if (kept.length > 0 && usedChars + length > budget) {
      break;
    }
    kept.unshift(runtimeMessages);
    usedChars += length;
    firstKeptIndex = index;
  }

  const olderCount = firstKeptIndex;
  const history: ProducerRuntimeMessage[] = [];
  if (olderCount > 0) {
    history.push({
      role: 'user',
      content: `[Context note: ${olderCount} earlier exchange(s) in this conversation were summarized to stay within the history budget.]`,
    });
  }
  for (const runtimeMessages of kept) {
    history.push(...runtimeMessages);
  }
  return history;
}
