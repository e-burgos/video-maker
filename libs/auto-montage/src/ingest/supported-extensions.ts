import type { MediaKind } from '@video-maker/timeline-core';

const EXTENSION_KINDS: Readonly<Record<string, MediaKind>> = {
  '.mp4': 'video',
  '.mov': 'video',
  '.mkv': 'video',
  '.avi': 'video',
  '.webm': 'video',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.webp': 'image',
  '.wav': 'audio',
  '.mp3': 'audio',
  '.m4a': 'audio',
  '.aac': 'audio',
  '.flac': 'audio',
};

function extensionOf(fileName: string): string | undefined {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? undefined : fileName.slice(dotIndex).toLowerCase();
}

export function mediaKindForExtension(fileName: string): MediaKind | undefined {
  const extension = extensionOf(fileName);
  return extension === undefined ? undefined : EXTENSION_KINDS[extension];
}

export function isSupportedExtension(fileName: string): boolean {
  return mediaKindForExtension(fileName) !== undefined;
}
