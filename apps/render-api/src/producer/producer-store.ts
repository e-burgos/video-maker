import { serializeMontageDocument, toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { appendProducerMessageToMarkdown } from './producer-conversation-markdown';
import {
  EMPTY_PRODUCER_CONVERSATION,
  parseProducerConversation,
  parseProducerSession,
} from './producer-documents';
import type { ProducerConversation, ProducerMessage, ProducerSession } from './producer-documents';
import {
  producerConversationMarkdownPath,
  producerConversationPath,
  producerDirectoryPath,
  producerSessionPath,
  producerTurnLogPath,
  producerTurnsDirectoryPath,
} from './producer-paths';

async function readJsonDocument(
  deps: RenderApiDependencies,
  project: MediaProject,
  relativePath: string,
): Promise<unknown | null> {
  const absolutePath = toAbsolutePath(project, relativePath);
  if ((await deps.storage.stat(absolutePath)) === null) {
    return null;
  }

  const raw = await deps.storage.readTextFile(absolutePath);
  try {
    return JSON.parse(raw);
  } catch {
    throw new PipelineStageError({
      code: 'PRODUCER_STATE_INVALID',
      stage: null,
      resource: relativePath,
      expected: 'a JSON document',
    });
  }
}

export async function readProducerConversation(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<ProducerConversation> {
  const relativePath = producerConversationPath();
  const document = await readJsonDocument(deps, project, relativePath);
  return document === null
    ? EMPTY_PRODUCER_CONVERSATION
    : parseProducerConversation(document, relativePath);
}

export async function readProducerSession(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<ProducerSession | null> {
  const relativePath = producerSessionPath();
  const document = await readJsonDocument(deps, project, relativePath);
  return document === null ? null : parseProducerSession(document, relativePath);
}

export async function writeProducerConversation(
  deps: RenderApiDependencies,
  project: MediaProject,
  conversation: ProducerConversation,
): Promise<string> {
  const relativePath = producerConversationPath();
  await deps.storage.ensureDirectory(toAbsolutePath(project, producerDirectoryPath()));
  await deps.storage.writeTextFile(
    toAbsolutePath(project, relativePath),
    serializeMontageDocument(conversation),
  );
  return relativePath;
}

export async function writeProducerSession(
  deps: RenderApiDependencies,
  project: MediaProject,
  session: ProducerSession,
): Promise<string> {
  const relativePath = producerSessionPath();
  await deps.storage.ensureDirectory(toAbsolutePath(project, producerDirectoryPath()));
  await deps.storage.writeTextFile(
    toAbsolutePath(project, relativePath),
    serializeMontageDocument(session),
  );
  return relativePath;
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
