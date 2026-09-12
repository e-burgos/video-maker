import { VoiceScriptManifestSchema } from '@video-maker/timeline-core';
import type { VoiceScriptManifest } from '@video-maker/timeline-core';

export function parseVoiceScriptManifest(raw: string): VoiceScriptManifest | null {
  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = VoiceScriptManifestSchema.safeParse(document);
  return parsed.success ? parsed.data : null;
}
