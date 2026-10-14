import type { VoiceModel } from '@video-maker/media-local';

import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { translateVoiceError } from '../../errors/translate-voice-error';
import { isElevenLabsKeyConfigured, readConfiguredElevenLabsVoices } from '../../voice/elevenlabs-voice';
import { voicePreviewUrl } from '../../voice/voice-preview-url';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpResponse } from '../http-message';

export interface PiperVoiceListingEntry extends VoiceModel {
  readonly engine: 'piper';
  readonly previewUrl: string;
}

export interface ElevenLabsVoiceListingEntry {
  readonly engine: 'elevenlabs';
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly language: VoiceModel['language'];
  readonly quality: null;
  readonly isDefault: false;
  readonly previewUrl: string;
}

export type VoiceListingEntry = PiperVoiceListingEntry | ElevenLabsVoiceListingEntry;

export interface VoicesBody {
  readonly voices: readonly VoiceListingEntry[];
}

const ELEVENLABS_VOICE_LANGUAGE: VoiceModel['language'] = { code: 'es', region: null };

async function listElevenLabsEntries(deps: RenderApiDependencies): Promise<readonly ElevenLabsVoiceListingEntry[]> {
  if (!(await isElevenLabsKeyConfigured(deps))) {
    return [];
  }
  return readConfiguredElevenLabsVoices(deps).map((voice) => ({
    engine: 'elevenlabs',
    id: voice.id,
    label: voice.label,
    description: voice.description,
    language: ELEVENLABS_VOICE_LANGUAGE,
    quality: null,
    isDefault: false,
    previewUrl: voicePreviewUrl(voice.id),
  }));
}

export async function handleListVoices(deps: RenderApiDependencies): Promise<HttpResponse> {
  let voices: readonly VoiceModel[];
  try {
    voices = await deps.listVoiceModels();
  } catch (cause) {
    throw translateVoiceError(cause, null, 'tts-voices');
  }

  const body: VoicesBody = {
    voices: [
      ...voices.map((voice): PiperVoiceListingEntry => ({
        ...voice,
        engine: 'piper',
        previewUrl: voicePreviewUrl(voice.id),
      })),
      ...(await listElevenLabsEntries(deps)),
    ],
  };

  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}
