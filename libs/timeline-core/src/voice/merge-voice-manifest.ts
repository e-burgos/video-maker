import type { VoiceManifest, VoiceTrack } from '../schemas/voice-manifest.schema';
import { hashDirectedNarration } from './hash-narration';
import type { VoiceDirection } from './voice-direction';

export function findVoiceTrack(manifest: VoiceManifest, sceneId: string): VoiceTrack | null {
  return manifest.tracks.find((track) => track.sceneId === sceneId) ?? null;
}

export function isVoiceTrackStale(track: VoiceTrack, narration: string, direction?: VoiceDirection): boolean {
  return track.narrationHash !== hashDirectedNarration(narration, direction);
}

export function upsertVoiceTrack(manifest: VoiceManifest, track: VoiceTrack): VoiceManifest {
  const others = manifest.tracks.filter((candidate) => candidate.sceneId !== track.sceneId);
  return {
    ...manifest,
    tracks: [...others, track].sort((left, right) => left.index - right.index),
  };
}

export function dropVoiceTracksOutsideScenes(
  manifest: VoiceManifest,
  sceneIds: readonly string[],
): VoiceManifest {
  const known = new Set(sceneIds);
  return { ...manifest, tracks: manifest.tracks.filter((track) => known.has(track.sceneId)) };
}
