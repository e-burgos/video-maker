import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import {
  VOICE_PREVIEW_CACHE_CONTROL,
  VOICE_PREVIEW_CONTENT_TYPE,
  buildVoicePreview,
} from '../../voice/voice-preview';
import type { HttpResponse } from '../http-message';
import type { RenderApiRuntime } from '../render-api-runtime';
import type { RouteParams } from '../router';

export async function handleGetVoicePreview(
  deps: RenderApiDependencies,
  params: RouteParams,
  runtime: RenderApiRuntime,
): Promise<HttpResponse> {
  const voiceId = params.voiceId ?? '';

  const preview = await runtime.voicePreviewSerializer.run(voiceId, () =>
    buildVoicePreview(deps, voiceId),
  );

  return {
    status: 200,
    headers: {
      'content-type': VOICE_PREVIEW_CONTENT_TYPE,
      'content-length': String(preview.sizeBytes),
      'cache-control': VOICE_PREVIEW_CACHE_CONTROL,
    },
    body: undefined,
    stream: () => deps.voicePreviewCache.openReadStream(preview.path),
  };
}
