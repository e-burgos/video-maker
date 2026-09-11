export const VOICE_PREVIEW_ROUTE_PATTERN = '/voices/:voiceId/preview';

export function voicePreviewUrl(voiceId: string): string {
  return `/voices/${encodeURIComponent(voiceId)}/preview`;
}
