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
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.srt': 'application/x-subrip',
  '.vtt': 'text/vtt',
};

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export function contentTypeFor(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) {
    return DEFAULT_CONTENT_TYPE;
  }

  const extension = fileName.slice(dotIndex).toLowerCase();
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? DEFAULT_CONTENT_TYPE;
}
