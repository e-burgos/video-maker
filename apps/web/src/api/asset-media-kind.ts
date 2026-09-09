export type AssetMediaKind = 'video' | 'audio' | 'image' | 'other';

const KIND_BY_EXTENSION: Readonly<Record<string, AssetMediaKind>> = {
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

const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
};

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase();
}

export function assetMediaKind(fileName: string): AssetMediaKind {
  return KIND_BY_EXTENSION[fileExtension(fileName)] ?? 'other';
}

export function assetContentType(fileName: string): string {
  return CONTENT_TYPE_BY_EXTENSION[fileExtension(fileName)] ?? DEFAULT_CONTENT_TYPE;
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} kB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
