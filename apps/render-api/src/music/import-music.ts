import { toAbsolutePath, workPath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import type { FetchRemotePort } from '../deps/render-api-dependencies';
import type { ObjectStorage } from '../deps/object-storage';
import { resolveUniqueFileName } from '../media-search/download-shared';
import { isPortableFileName } from '../store/asset-path';
import { COMMONS_USER_AGENT } from './commons-music-search';
import type { CommonsMusicResult } from './commons-music-search';

export const MUSIC_DOWNLOAD_HOST = 'upload.wikimedia.org';
export const MAX_MUSIC_DOWNLOAD_BYTES = 50 * 1024 * 1024;
export const MUSIC_DOWNLOAD_TIMEOUT_MS = 30_000;

export interface DownloadedCommonsAudio {
  readonly relativePath: string;
  readonly absolutePath: string;
}

export function isAllowedMusicDownloadHost(url: string): boolean {
  try {
    return new URL(url).host === MUSIC_DOWNLOAD_HOST;
  } catch {
    return false;
  }
}

function fileNameFromDownloadUrl(downloadUrl: string, fallbackBaseName: string): string {
  const pathname = new URL(downloadUrl).pathname;
  const lastSegment = pathname.split('/').pop() ?? '';
  const decoded = decodeURIComponent(lastSegment);
  return isPortableFileName(decoded) ? decoded : `${fallbackBaseName}.audio`;
}

export async function downloadCommonsAudioFile(
  storage: ObjectStorage,
  fetchRemote: FetchRemotePort,
  project: MediaProject,
  result: CommonsMusicResult,
): Promise<DownloadedCommonsAudio> {
  if (!isAllowedMusicDownloadHost(result.downloadUrl)) {
    throw new Error('Wikimedia Commons download host mismatch');
  }

  const response = await fetchRemote(result.downloadUrl, {
    headers: { 'user-agent': COMMONS_USER_AGENT },
    timeoutMs: MUSIC_DOWNLOAD_TIMEOUT_MS,
  });

  if (response.status !== 200) {
    throw new Error(`Wikimedia Commons download responded with status ${response.status}`);
  }

  const contentLength = Number(response.headers['content-length']);
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw new Error('Wikimedia Commons download did not report a usable content-length');
  }
  if (contentLength > MAX_MUSIC_DOWNLOAD_BYTES) {
    throw new Error('Wikimedia Commons file exceeds the download size limit');
  }

  const audioDirectory = toAbsolutePath(project, 'raw/audio');
  await storage.ensureDirectory(audioDirectory);

  const baseName = fileNameFromDownloadUrl(result.downloadUrl, result.resultId);
  const fileName = await resolveUniqueFileName(storage, audioDirectory, baseName);
  const relativePath = `raw/audio/${fileName}`;

  const uploadsDirectory = toAbsolutePath(project, workPath('.uploads'));
  await storage.ensureDirectory(uploadsDirectory);

  const outcome = await storage.writeTemporary({
    directory: uploadsDirectory,
    source: response.body(),
    expectedBytes: contentLength,
    limitBytes: MAX_MUSIC_DOWNLOAD_BYTES,
  });

  if (outcome.kind !== 'written') {
    throw new Error('Wikimedia Commons download did not complete');
  }

  const absolutePath = toAbsolutePath(project, relativePath);
  await storage.promoteTemporary(outcome.temporaryPath, absolutePath);

  return { relativePath, absolutePath };
}
