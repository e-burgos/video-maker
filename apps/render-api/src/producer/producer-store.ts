import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import type { ProducerSession as StoredProducerSession } from '@video-maker/local-store';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { appendProducerMessageToMarkdown } from './producer-conversation-markdown';
import type { ProducerMessage, ProducerSession } from './producer-documents';
import {
  producerConversationMarkdownPath,
  producerDirectoryPath,
  producerTurnLogPath,
  producerTurnsDirectoryPath,
} from './producer-paths';

export function readProducerConversation(
  deps: RenderApiDependencies,
  project: MediaProject,
): readonly ProducerMessage[] {
  return deps.localStore.producer.getConversation(project.slug);
}

export function appendProducerMessage(
  deps: RenderApiDependencies,
  project: MediaProject,
  message: ProducerMessage,
): void {
  deps.localStore.producer.appendMessage(project.slug, message);
}

function toProducerSession(record: StoredProducerSession): ProducerSession {
  return {
    sessionId: record.sessionId,
    model: record.model,
    createdAt: record.startedAt,
    lastTurnAt: record.updatedAt,
  };
}

export function readProducerSession(
  deps: RenderApiDependencies,
  project: MediaProject,
): ProducerSession | null {
  const record = deps.localStore.producer.getSession(project.slug);
  return record === null ? null : toProducerSession(record);
}

export function writeProducerSession(
  deps: RenderApiDependencies,
  project: MediaProject,
  session: ProducerSession,
): void {
  deps.localStore.producer.setSession(project.slug, {
    sessionId: session.sessionId,
    model: session.model,
    startedAt: session.createdAt,
    updatedAt: session.lastTurnAt,
  });
}

export async function appendProducerConversationMarkdown(
  deps: RenderApiDependencies,
  project: MediaProject,
  message: ProducerMessage,
): Promise<string> {
  const relativePath = producerConversationMarkdownPath();
  const absolutePath = toAbsolutePath(project, relativePath);

  await deps.storage.ensureDirectory(toAbsolutePath(project, producerDirectoryPath()));
  const existing = (await deps.storage.stat(absolutePath)) === null
    ? null
    : await deps.storage.readTextFile(absolutePath);

  await deps.storage.writeTextFile(
    absolutePath,
    appendProducerMessageToMarkdown(existing, project.slug, message),
  );
  return relativePath;
}

export async function writeProducerTurnLog(
  deps: RenderApiDependencies,
  project: MediaProject,
  turnId: string,
  lines: readonly string[],
): Promise<string> {
  const relativePath = producerTurnLogPath(turnId);
  await deps.storage.ensureDirectory(toAbsolutePath(project, producerTurnsDirectoryPath()));
  await deps.storage.writeTextFile(
    toAbsolutePath(project, relativePath),
    lines.map((line) => `${line}\n`).join(''),
  );
  return relativePath;
}
