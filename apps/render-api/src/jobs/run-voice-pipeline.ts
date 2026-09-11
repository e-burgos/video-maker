import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import {
  DEFAULT_VOICE_SCRIPT_GAP_MS,
  emptyVoiceManifest,
  hashNarration,
  upsertVoiceTrack,
} from '@video-maker/timeline-core';
import type { StoryboardScene, VoiceManifest, VoiceTrack } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { readStoredStoryboard } from '../storyboard/storyboard-store';
import { VOICE_TRACK_CHANNELS, VOICE_TRACK_SAMPLE_RATE } from '../voice/voice-format';
import {
  voiceDirectoryPath,
  voiceManifestPath,
  voiceNarrationTextPath,
  voiceSourceWavPath,
  voiceTrackPath,
} from '../voice/voice-paths';
import { selectVoiceScenes } from '../voice/select-voice-scenes';
import {
  ensureVoiceDirectories,
  resolveVoiceModel,
  runVoiceStage,
  transcribeVoiceTrack,
} from '../voice/voice-synthesis-steps';
import type { ResolvedVoiceModel } from '../voice/voice-synthesis-steps';
import { readVoiceManifestIfUsable, writeVoiceManifest } from '../voice/voice-store';
import type { VoiceJobReport, VoiceJobSceneReport } from './render-job';
import { runVoiceScriptPipeline } from './run-voice-script-pipeline';
import { voiceCheckpoint } from './voice-pipeline-observer';
import type { VoicePipelineObserver } from './voice-pipeline-observer';

export interface VoicePipelineRequest {
  readonly project: MediaProject;
  readonly voiceId: string | null;
  readonly sceneIds: readonly string[] | null;
  readonly scriptText?: string | null;
  readonly scriptPath?: string | null;
  readonly gapMs?: number;
}

interface SynthesizedScene {
  readonly scene: StoryboardScene;
  readonly trackPath: string;
  readonly durationMs: number;
  readonly sampleRate: number;
}

async function synthesizeScene(
  scene: StoryboardScene,
  model: ResolvedVoiceModel,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<SynthesizedScene> {
  const textPath = voiceNarrationTextPath(scene.id);
  const sourceWavPath = voiceSourceWavPath(scene.id);
  const trackPath = voiceTrackPath(scene.id);

  await deps.storage.writeTextFile(
    toAbsolutePath(project, textPath),
    `${scene.narration.replace(/\s+/gu, ' ').trim()}\n`,
  );

  await deps.synthesizeVoice({
    textPath: toAbsolutePath(project, textPath),
    outPath: toAbsolutePath(project, sourceWavPath),
    modelPath: model.path,
    projectRoot: project.root,
  });

  await deps.extractVoiceAudio({
    inputPath: toAbsolutePath(project, sourceWavPath),
    outPath: toAbsolutePath(project, trackPath),
    sampleRate: VOICE_TRACK_SAMPLE_RATE,
    channels: VOICE_TRACK_CHANNELS,
    projectRoot: project.root,
  });

  const probed = await deps.probeAsset({
    path: toAbsolutePath(project, trackPath),
    assetId: trackPath,
  });

  return {
    scene,
    trackPath,
    durationMs: probed.durationMs,
    sampleRate: probed.audio?.sampleRate ?? VOICE_TRACK_SAMPLE_RATE,
  };
}

export async function runStoryboardVoicePipeline(
  request: VoicePipelineRequest,
  deps: RenderApiDependencies,
  observer: VoicePipelineObserver,
): Promise<VoiceJobReport> {
  const document = await readStoredStoryboard(deps, request.project);
  const selected = selectVoiceScenes(document, request.sceneIds);
  const storedManifest = await readVoiceManifestIfUsable(deps, request.project);
  const baseManifest: VoiceManifest = storedManifest ?? emptyVoiceManifest(document.id, document.language);

  const uploaded = new Set(
    baseManifest.tracks.filter((track) => track.source === 'uploaded').map((track) => track.sceneId),
  );
  const pending = selected.filter((scene) => !uploaded.has(scene.id));

  const model = await runVoiceStage('synthesize', null, () => resolveVoiceModel(deps, request.voiceId));
  await runVoiceStage('synthesize', voiceDirectoryPath(), () => ensureVoiceDirectories(deps, request.project));

  voiceCheckpoint(observer, 'synthesize');
  observer.stageStarted('synthesize');

  const synthesized: SynthesizedScene[] = [];
  for (const scene of pending) {
    voiceCheckpoint(observer, 'synthesize');
    synthesized.push(
      await runVoiceStage('synthesize', scene.id, () =>
        synthesizeScene(scene, model, deps, request.project),
      ),
    );
    observer.sceneProcessed('synthesize', synthesized.length, pending.length);
  }

  voiceCheckpoint(observer, 'transcribe');
  observer.stageStarted('transcribe');

  let manifest = baseManifest;
  const scenes: VoiceJobSceneReport[] = [];
  let transcribed = 0;

  for (const entry of synthesized) {
    voiceCheckpoint(observer, 'transcribe');
    const wordsPath = await runVoiceStage('transcribe', entry.scene.id, () =>
      transcribeVoiceTrack(entry.scene.id, entry.trackPath, document.language, deps, request.project),
    );

    const track: VoiceTrack = {
      sceneId: entry.scene.id,
      index: entry.scene.index,
      source: 'generated',
      path: entry.trackPath,
      wordsPath,
      durationMs: entry.durationMs,
      sampleRate: entry.sampleRate,
      voiceId: model.id,
      narrationHash: hashNarration(entry.scene.narration),
      updatedAt: deps.clock.nowIso(),
    };

    manifest = upsertVoiceTrack(manifest, track);
    scenes.push({
      sceneId: track.sceneId,
      path: track.path,
      wordsPath: track.wordsPath,
      durationMs: track.durationMs,
      source: track.source,
    });

    transcribed += 1;
    observer.sceneProcessed('transcribe', transcribed, synthesized.length);
  }

  voiceCheckpoint(observer, 'persist');
  observer.stageStarted('persist');

  const manifestPath = await runVoiceStage('persist', voiceManifestPath(), () =>
    writeVoiceManifest(deps, request.project, manifest),
  );

  return {
    source: 'storyboard',
    manifestPath,
    storyboardId: document.id,
    voiceId: model.id,
    language: document.language,
    scenes,
    track: null,
  };
}

export async function runVoicePipeline(
  request: VoicePipelineRequest,
  deps: RenderApiDependencies,
  observer: VoicePipelineObserver,
): Promise<VoiceJobReport> {
  const scriptText = request.scriptText ?? null;
  const scriptPath = request.scriptPath ?? null;

  if (scriptText === null && scriptPath === null) {
    return runStoryboardVoicePipeline(request, deps, observer);
  }

  return runVoiceScriptPipeline(
    {
      project: request.project,
      voiceId: request.voiceId,
      scriptText,
      scriptPath,
      gapMs: request.gapMs ?? DEFAULT_VOICE_SCRIPT_GAP_MS,
    },
    deps,
    observer,
  );
}
