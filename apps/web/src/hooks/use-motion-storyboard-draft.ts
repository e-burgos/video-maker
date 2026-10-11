import { useState } from 'react';
import type { VoiceDirection } from '@video-maker/timeline-core';

import {
  applyMotionDraft,
  directionsDirty,
  musicDirty,
  musicEditValid,
  sceneDirectionOf,
  storedMusicEdit,
} from '../api/motion-storyboard-draft';
import type { MusicEdit, SceneDirectionEdits } from '../api/motion-storyboard-draft';
import type { MotionScene, MotionStoryboard } from '../api/motion-types';
import { useRenderApi } from '../api/render-api-context';
import type { MotionJob } from '../api/motion-types';
import { useApiAction } from './use-api-action';

export function useMotionStoryboardDraft(
  slug: string,
  storyboard: MotionStoryboard | null,
  onSaved: () => void,
  onJobStarted: (job: MotionJob) => void,
) {
  const client = useRenderApi();
  const [edits, setEdits] = useState<SceneDirectionEdits>({});
  const [musicEdit, setMusicEdit] = useState<MusicEdit | null>(null);
  const [saved, setSaved] = useState(false);

  const music = musicEdit ?? (storyboard === null ? null : storedMusicEdit(storyboard));
  const dirty =
    storyboard !== null && (directionsDirty(storyboard, edits) || musicDirty(storyboard, music));
  const valid = musicEditValid(music);

  const saveAction = useApiAction((next: MotionStoryboard) => client.putMotionStoryboard(slug, next));
  const regenerateAction = useApiAction(() =>
    client.createMotionJob(slug, { phase: 'video', overwrite: true }),
  );

  async function persist(): Promise<boolean> {
    if (storyboard === null) {
      return false;
    }
    setSaved(false);
    const result = await saveAction.run(applyMotionDraft(storyboard, edits, music));
    if (result === null) {
      return false;
    }
    setEdits({});
    setMusicEdit(null);
    setSaved(true);
    onSaved();
    return true;
  }

  async function regenerate() {
    if (dirty && !(await persist())) {
      return;
    }
    const job = await regenerateAction.run();
    if (job !== null) {
      onJobStarted(job);
    }
  }

  return {
    edits,
    music,
    dirty,
    valid,
    saved,
    saveAction,
    regenerateAction,
    directionOf: (scene: MotionScene) => sceneDirectionOf(scene, edits),
    setDirection: (sceneId: string, direction: VoiceDirection | undefined) => {
      setSaved(false);
      setEdits((current) => ({ ...current, [sceneId]: direction }));
    },
    setMusicMode: (mode: MusicEdit['mode']) => {
      setSaved(false);
      setMusicEdit({ floorText: music?.floorText ?? '', mode });
    },
    setFloorText: (floorText: string) => {
      setSaved(false);
      setMusicEdit({ mode: music?.mode ?? 'segments', floorText });
    },
    save: persist,
    regenerate,
  };
}
