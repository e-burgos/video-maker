import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { voiceScriptTrackPath } from './voice-paths';

export async function assertVoiceScriptTrackNotPersisted(
  deps: RenderApiDependencies,
  project: MediaProject,
  overwrite: boolean,
): Promise<void> {
  if (overwrite) {
    return;
  }

  const relativePath = voiceScriptTrackPath();
  if ((await deps.storage.stat(toAbsolutePath(project, relativePath))) !== null) {
    throw new PipelineStageError({
      code: 'VOICE_ALREADY_EXISTS',
      stage: null,
      resource: relativePath,
      expected: 'overwrite: true to replace the voice track built from a script',
    });
  }
}
