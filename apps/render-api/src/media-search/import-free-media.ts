import { toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import type { FetchRemotePort } from '../deps/render-api-dependencies';
import type { ObjectStorage } from '../deps/object-storage';
import { isPortableFileName } from '../store/asset-path';
import { resolveUniqueFileName } from './download-shared';
import type { FreeMediaKind, FreeMediaResult } from './free-media-result';

export const FREE_MEDIA_DOWNLOAD_HOSTS = ['upload.wikimedia.org', 'images-assets.nasa.gov'] as const;
export const FREE_MEDIA_USER_AGENT = 'video-maker-studio/0.1 (local desktop app)';
export const MAX_FREE_VIDEO_DOWNLOAD_BYTES = 200 * 1024 * 1024;
export const MAX_FREE_IMAGE_DOWNLOAD_BYTES = 30 * 1024 * 1024;
export const FREE_MEDIA_DOWNLOAD_TIMEOUT_MS = 60_000;

export interface DownloadedFreeMedia {
  readonly relativePath: string;
  readonly absolutePath: string;
}

export function isAllowedFreeMediaDownloadHost(url: string): boolean {
  try {
    return (FREE_MEDIA_DOWNLOAD_HOSTS as readonly string[]).includes(new URL(url).host);
  } catch {
    return false;
  }
}

function directoryFor(kind: FreeMediaKind): string {
  return kind === 'video' ? 'raw/broll' : 'raw/images';
}

function maxDownloadBytesFor(kind: FreeMediaKind): number {
  return kind === 'video' ? MAX_FREE_VIDEO_DOWNLOAD_BYTES : MAX_FREE_IMAGE_DOWNLOAD_BYTES;
}

function fallbackExtensionFor(kind: FreeMediaKind): string {
  return kind === 'video' ? '.mp4' : '.jpg';
}

function toAsciiFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._~-]+/g, '-')
    .replace(/-+(?=\.)/g, '')
    .replace(/^[-.]+/, '');
}

function fileNameFromDownloadUrl(downloadUrl: string, fallbackBaseName: string, kind: FreeMediaKind): string {
  const pathname = new URL(downloadUrl).pathname;
  const lastSegment = pathname.split('/').pop() ?? '';
  const ascii = toAsciiFileName(decodeURIComponent(lastSegment));
  return isPortableFileName(ascii) && ascii !== '' ? ascii : `${fallbackBaseName}${fallbackExtensionFor(kind)}`;
}

export async function downloadFreeMediaFile(
  storage: ObjectStorage,
  fetchRemote: FetchRemotePort,
  project: MediaProject,
  result: FreeMediaResult,
): Promise<DownloadedFreeMedia> {
  if (!isAllowedFreeMediaDownloadHost(result.downloadUrl)) {
    throw new Error('Free media download host mismatch');
  }

  const response = await fetchRemote(result.downloadUrl, {
    headers: { 'user-agent': FREE_MEDIA_USER_AGENT },
    timeoutMs: FREE_MEDIA_DOWNLOAD_TIMEOUT_MS,
  });

  if (response.status !== 200) {
    throw new Error(`Free media download responded with status ${response.status}`);
  }

  const maxBytes = maxDownloadBytesFor(result.kind);
  const contentLength = Number(response.headers['content-length']);
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw new Error('Free media download did not report a usable content-length');
  }
  if (contentLength > maxBytes) {
    throw new Error('Free media file exceeds the download size limit');
  }

  const targetDirectory = toAbsolutePath(project, directoryFor(result.kind));
  await storage.ensureDirectory(targetDirectory);

  const baseName = fileNameFromDownloadUrl(result.downloadUrl, result.resultId, result.kind);
  const fileName = await resolveUniqueFileName(storage, targetDirectory, baseName);
  const relativePath = `${directoryFor(result.kind)}/${fileName}`;

  const uploadsDirectory = toAbsolutePath(project, workPath('.uploads'));
  await storage.ensureDirectory(uploadsDirectory);

  const outcome = await storage.writeTemporary({
    directory: uploadsDirectory,
    source: response.body(),
    expectedBytes: contentLength,
    limitBytes: maxBytes,
  });

  if (outcome.kind !== 'written') {
    throw new Error('Free media download did not complete');
  }

  const absolutePath = toAbsolutePath(project, relativePath);
  await storage.promoteTemporary(outcome.temporaryPath, absolutePath);

  return { relativePath, absolutePath };
}
