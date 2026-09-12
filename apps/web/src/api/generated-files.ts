import type { GeneratedFile, GeneratedListing } from './render-api-types';

export const VOICE_TRACK_PATH = 'work/voice/voice.wav';
export const PRODUCER_SCRIPT_PATH = 'work/producer/script.txt';
export const VOICE_SCRIPT_MANIFEST_PATH = 'work/voice/script-manifest.json';

export type GeneratedGroup = {
  narration: GeneratedFile | null;
  script: GeneratedFile | null;
  deliverables: GeneratedFile[];
};

function fileAt(listing: GeneratedListing | null, path: string): GeneratedFile | null {
  return listing?.files.find((file) => file.path === path) ?? null;
}

export function groupGeneratedFiles(listing: GeneratedListing | null): GeneratedGroup {
  return {
    narration: fileAt(listing, VOICE_TRACK_PATH),
    script: fileAt(listing, PRODUCER_SCRIPT_PATH),
    deliverables: (listing?.files ?? []).filter(
      (file) => file.path.startsWith('out/') && file.path.endsWith('.mp4'),
    ),
  };
}

export function hasGeneratedOutput(group: GeneratedGroup): boolean {
  return group.narration !== null || group.script !== null || group.deliverables.length > 0;
}

export function formatFileSize(sizeBytes: number): string {
  const megabytes = sizeBytes / 1_000_000;
  return megabytes >= 1
    ? `${megabytes.toFixed(1)} MB`
    : `${Math.max(1, Math.round(sizeBytes / 1000))} kB`;
}
