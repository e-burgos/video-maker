import type { BinaryName } from '@video-maker/media-local';

export const MEDIA_BINARY_NAMES = [
  'ffmpeg',
  'ffprobe',
  'whisperCli',
  'whisperModel',
  'piperCli',
  'piperModel',
] as const satisfies readonly BinaryName[];

export type MediaBinaryName = (typeof MEDIA_BINARY_NAMES)[number];

export interface BinaryStatus {
  readonly name: MediaBinaryName;
  readonly envVar: string;
  readonly resolved: boolean;
}

export interface ResolvedMediaBinaries {
  readonly ffmpeg: string;
  readonly ffprobe: string;
}
