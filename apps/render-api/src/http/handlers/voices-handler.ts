import type { VoiceModel } from '@video-maker/media-local';

import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { translateVoiceError } from '../../errors/translate-voice-error';
import { voicePreviewUrl } from '../../voice/voice-preview-url';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpResponse } from '../http-message';

export interface VoiceListingEntry extends VoiceModel {
  readonly previewUrl: string;
}

export interface VoicesBody {
  readonly voices: readonly VoiceListingEntry[];
}

export async function handleListVoices(deps: RenderApiDependencies): Promise<HttpResponse> {
  let voices: readonly VoiceModel[];
  try {
    voices = await deps.listVoiceModels();
  } catch (cause) {
    throw translateVoiceError(cause, null, 'piper-voices');
  }

  const body: VoicesBody = {
    voices: voices.map((voice) => ({ ...voice, previewUrl: voicePreviewUrl(voice.id) })),
  };

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}
