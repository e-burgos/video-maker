import type { ProducerMessage } from './producer-documents';

const ROLE_LABELS: Readonly<Record<ProducerMessage['role'], string>> = {
  user: 'Usuario',
  assistant: 'Productor',
};

export function producerConversationHeading(slug: string, isoTimestamp: string): string {
  return `# ${slug} — conversación con el productor (${isoTimestamp.slice(0, 10)})\n`;
}

export function toSingleLine(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

export function producerMessageBullet(message: ProducerMessage): string {
  return `- ${ROLE_LABELS[message.role]}: ${toSingleLine(message.text)}\n`;
}

export function appendProducerMessageToMarkdown(
  existing: string | null,
  slug: string,
  message: ProducerMessage,
): string {
  const bullet = producerMessageBullet(message);
  if (existing === null || existing.trim() === '') {
    return `${producerConversationHeading(slug, message.createdAt)}\n${bullet}`;
  }
  return existing.endsWith('\n') ? `${existing}${bullet}` : `${existing}\n${bullet}`;
}
