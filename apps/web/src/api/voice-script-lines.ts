import type { VoiceScriptLine, VoiceScriptManifest } from '@video-maker/timeline-core';

export function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function lineEndMs(line: VoiceScriptLine): number {
  return line.endMs ?? line.startMs + line.durationMs;
}

export function overflowOf(line: VoiceScriptLine): number {
  return line.overflowMs ?? 0;
}

export function requestedStartOf(line: VoiceScriptLine): number | null {
  return line.requestedStartMs ?? null;
}

export function totalDurationSeconds(manifest: VoiceScriptManifest): string {
  return (manifest.durationMs / 1000).toFixed(1);
}
