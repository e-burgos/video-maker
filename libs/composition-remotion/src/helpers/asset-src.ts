import type { MediaAsset } from '@video-maker/timeline-core';
import { staticFile } from 'remotion';

const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const WINDOWS_DRIVE_SEGMENT_PATTERN = /^[a-zA-Z]:$/;

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path);
}

function toFileUrl(path: string): string {
  const segments = path
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0);

  const encodedSegments = segments.map((segment, index) =>
    index === 0 && WINDOWS_DRIVE_SEGMENT_PATTERN.test(segment) ? segment : encodeURIComponent(segment),
  );

  return `file:///${encodedSegments.join('/')}`;
}

export function assetSrc(asset: MediaAsset): string {
  const { path } = asset;

  if (URL_SCHEME_PATTERN.test(path)) {
    return path;
  }

  if (isAbsolutePath(path)) {
    return toFileUrl(path);
  }

  return staticFile(path);
}
