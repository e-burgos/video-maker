import { describeVideoMakerCapabilities } from '@video-maker/studio-capabilities';
import type { CapabilityVoice } from '@video-maker/studio-capabilities';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { loadSfxBank } from '../../sfx/load-sfx-bank';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpResponse } from '../http-message';
import { handleListVoices } from './voices-handler';
import type { VoicesBody } from './voices-handler';

function toCapabilityVoices(body: VoicesBody): readonly CapabilityVoice[] {
  return body.voices.map((voice) => ({
    id: voice.id,
    label: voice.label,
    engine: voice.engine,
    language: voice.language.region === null ? voice.language.code : `${voice.language.code}-${voice.language.region}`,
    isDefault: voice.isDefault,
  }));
}

async function listVoicesOrNone(deps: RenderApiDependencies): Promise<readonly CapabilityVoice[]> {
  try {
    return toCapabilityVoices((await handleListVoices(deps)).body as VoicesBody);
  } catch {
    return [];
  }
}

async function loadSfxBankOrNull(store: StoreConfig) {
  try {
    return await loadSfxBank(store.motionAssetsRoot);
  } catch {
    return null;
  }
}

export async function handleGetCapabilities(deps: RenderApiDependencies, store: StoreConfig): Promise<HttpResponse> {
  const [voices, sfxBank] = await Promise.all([listVoicesOrNone(deps), loadSfxBankOrNull(store)]);
  return {
    status: 200,
    headers: { 'content-type': JSON_CONTENT_TYPE },
    body: describeVideoMakerCapabilities({ voices, sfxBank }),
  };
}
