import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import type { ObjectStorage } from '../deps/object-storage';
import { CREDITS_FILE_PATH } from '../music/project-credits';
import { PUBLISH_DESCRIPTION_MAX_LENGTH } from '../jobs/publish-job-params';

const CREDITS_SUFFIX = '.credits.txt';
const PARAGRAPH_SEPARATOR = '\n\n';

export function creditsPathFor(videoFile: string): string {
  return `${videoFile.slice(0, -'.mp4'.length)}${CREDITS_SUFFIX}`;
}

interface CreditFields {
  readonly kind: string;
  readonly title: string;
  readonly author: string;
  readonly source: string;
  readonly license: string;
}

const CREDIT_LABELS: Readonly<Record<string, string>> = { music: 'Música', video: 'Video', image: 'Imagen' };

function field(entry: Record<string, unknown>, ...names: readonly string[]): string {
  const found = names.map((name) => entry[name]).find((value) => typeof value === 'string' && value.trim() !== '');
  return typeof found === 'string' ? found.trim() : '';
}

function toCreditFields(entry: unknown): CreditFields | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const fields = {
    kind: field(record, 'kind', 'role'),
    title: field(record, 'title'),
    author: field(record, 'author', 'artist'),
    source: field(record, 'source'),
    license: field(record, 'license'),
  };
  return fields.title === '' || fields.license === '' ? null : fields;
}

function creditLine(credit: CreditFields): string {
  const label = CREDIT_LABELS[credit.kind] ?? 'Crédito';
  const author = credit.author === '' ? '' : ` ${credit.author}`;
  const source = credit.source === '' ? '' : ` (${credit.source})`;
  return `${label}: "${credit.title}"${author}${source} · ${credit.license}`;
}

export function projectCreditsText(raw: unknown): string | null {
  const entries = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>).assets)
      ? ((raw as Record<string, unknown>).assets as unknown[])
      : [];
  const lines = [...new Set(entries.map(toCreditFields).filter((credit): credit is CreditFields => credit !== null).map(creditLine))];
  return lines.length === 0 ? null : lines.join('\n');
}

async function readTextIfFile(storage: ObjectStorage, absolutePath: string): Promise<string | null> {
  const stat = await storage.stat(absolutePath);
  if (stat === null || stat.kind !== 'file') {
    return null;
  }
  return storage.readTextFile(absolutePath);
}

async function readProjectCreditsText(storage: ObjectStorage, project: MediaProject): Promise<string | null> {
  const text = await readTextIfFile(storage, toAbsolutePath(project, CREDITS_FILE_PATH));
  if (text === null) {
    return null;
  }
  try {
    return projectCreditsText(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function readCreditsText(
  storage: ObjectStorage,
  project: MediaProject,
  videoFile: string,
): Promise<string | null> {
  const sidecar = (await readTextIfFile(storage, toAbsolutePath(project, creditsPathFor(videoFile))))?.trim() ?? '';
  return sidecar === '' ? readProjectCreditsText(storage, project) : sidecar;
}

export function appendCreditsOnce(description: string, credits: string | null): string {
  if (credits === null || description.includes(credits)) {
    return description;
  }
  const body = description
    .trimEnd()
    .slice(0, Math.max(0, PUBLISH_DESCRIPTION_MAX_LENGTH - credits.length - PARAGRAPH_SEPARATOR.length));
  return body === '' ? credits : `${body}${PARAGRAPH_SEPARATOR}${credits}`;
}
