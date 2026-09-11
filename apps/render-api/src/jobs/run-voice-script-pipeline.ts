import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import {
  VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION,
  splitVoiceScriptLines,
} from '@video-maker/timeline-core';
import type { VoiceScriptLine, VoiceScriptManifest } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { VOICE_TRACK_CHANNELS, VOICE_TRACK_SAMPLE_RATE } from '../voice/voice-format';
import { voiceLanguageFromModelId } from '../voice/voice-language';
import {
  voiceNarrationTextPath,
  voiceScriptLineId,
  voiceScriptManifestPath,
  voiceScriptTrackPath,
  voiceScriptWordsPath,
  voiceSourceWavPath,
  VOICE_SCRIPT_TRACK_ID,
} from '../voice/voice-paths';
import {
  ensureVoiceDirectories,
  resolveVoiceModel,
  runVoiceStage,
  transcribeVoiceTrackInto,
} from '../voice/voice-synthesis-steps';
import type { ResolvedVoiceModel } from '../voice/voice-synthesis-steps';
import { writeVoiceScriptManifest } from '../voice/voice-store';
import type { VoiceJobReport } from './render-job';
import { voiceCheckpoint } from './voice-pipeline-observer';
import type { VoicePipelineObserver } from './voice-pipeline-observer';

export interface VoiceScriptPipelineRequest {
  readonly project: MediaProject;
  readonly voiceId: string | null;
  readonly scriptText: string | null;
  readonly scriptPath: string | null;
  readonly gapMs: number;
}

interface SynthesizedLine {
  readonly index: number;
  readonly text: string;
  readonly path: string;
  readonly durationMs: number;
}

async function resolveScriptText(
  request: VoiceScriptPipelineRequest,
  deps: RenderApiDependencies,
): Promise<string> {
  if (request.scriptText !== null) {
    return request.scriptText;
  }

  const scriptPath = request.scriptPath ?? '';
  try {
    return await deps.storage.readTextFile(toAbsolutePath(request.project, scriptPath));
  } catch {
    throw new PipelineStageError({
      code: 'VOICE_SCRIPT_NOT_FOUND',
      stage: 'synthesize',
      resource: scriptPath,
      expected: 'a readable project-relative path to the script the voice reads',
    });
  }
}

function assertScriptHasLines(lines: readonly string[], resource: string | null): void {
  if (lines.length === 0) {
    throw new PipelineStageError({
      code: 'VOICE_SCRIPT_INVALID',
      stage: 'synthesize',
      resource,
      expected: 'a script with at least one non-empty line',
    });
  }
}

async function synthesizeLine(
  index: number,
  text: string,
  model: ResolvedVoiceModel,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<SynthesizedLine> {
  const lineId = voiceScriptLineId(index);
  const textPath = voiceNarrationTextPath(lineId);
  const wavPath = voiceSourceWavPath(lineId);

  await deps.storage.writeTextFile(toAbsolutePath(project, textPath), `${text}\n`);

  await deps.synthesizeVoice({
    textPath: toAbsolutePath(project, textPath),
    outPath: toAbsolutePath(project, wavPath),
    modelPath: model.path,
    projectRoot: project.root,
  });

  const probed = await deps.probeAsset({ path: toAbsolutePath(project, wavPath), assetId: wavPath });

  return { index, text, path: wavPath, durationMs: probed.durationMs };
}

function toManifestLines(lines: readonly SynthesizedLine[], gapMs: number): readonly VoiceScriptLine[] {
  let startMs = 0;

  return lines.map((line) => {
    const entry: VoiceScriptLine = {
      index: line.index,
      text: line.text,
      path: line.path,
      startMs,
      durationMs: line.durationMs,
    };
    startMs += line.durationMs + gapMs;
    return entry;
  });
}

export async function runVoiceScriptPipeline(
  request: VoiceScriptPipelineRequest,
  deps: RenderApiDependencies,
  observer: VoicePipelineObserver,
): Promise<VoiceJobReport> {
  const scriptText = await runVoiceStage('synthesize', request.scriptPath, () =>
    resolveScriptText(request, deps),
  );
  const lines = splitVoiceScriptLines(scriptText);
  assertScriptHasLines(lines, request.scriptPath);

  const model = await runVoiceStage('synthesize', null, () => resolveVoiceModel(deps, request.voiceId));
  const language = voiceLanguageFromModelId(model.id);

  await runVoiceStage('synthesize', null, () => ensureVoiceDirectories(deps, request.project));

  voiceCheckpoint(observer, 'synthesize');
  observer.stageStarted('synthesize');

  const synthesized: SynthesizedLine[] = [];
  for (const [position, text] of lines.entries()) {
    voiceCheckpoint(observer, 'synthesize');
    synthesized.push(
      await runVoiceStage('synthesize', voiceScriptLineId(position + 1), () =>
        synthesizeLine(position + 1, text, model, deps, request.project),
      ),
    );
    observer.sceneProcessed('synthesize', synthesized.length, lines.length);
  }

  const trackPath = voiceScriptTrackPath();

  await runVoiceStage('synthesize', trackPath, () =>
    deps.concatVoiceTracks({
      inputPaths: synthesized.map((line) => toAbsolutePath(request.project, line.path)),
      outPath: toAbsolutePath(request.project, trackPath),
      gapMs: request.gapMs,
      sampleRate: VOICE_TRACK_SAMPLE_RATE,
      channels: VOICE_TRACK_CHANNELS,
      projectRoot: request.project.root,
    }),
  );

  const track = await runVoiceStage('synthesize', trackPath, () =>
    deps.probeAsset({ path: toAbsolutePath(request.project, trackPath), assetId: trackPath }),
  );

  voiceCheckpoint(observer, 'transcribe');
  observer.stageStarted('transcribe');

  const wordsPath = await runVoiceStage('transcribe', trackPath, () =>
    transcribeVoiceTrackInto(
      VOICE_SCRIPT_TRACK_ID,
      trackPath,
      voiceScriptWordsPath(),
      language,
      deps,
      request.project,
    ),
  );

  observer.sceneProcessed('transcribe', 1, 1);

  voiceCheckpoint(observer, 'persist');
  observer.stageStarted('persist');

  const manifest: VoiceScriptManifest = {
    schemaVersion: VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION,
    source: 'script',
    language,
    voiceId: model.id,
    gapMs: request.gapMs,
    path: trackPath,
    wordsPath,
    durationMs: track.durationMs,
    sampleRate: track.audio?.sampleRate ?? VOICE_TRACK_SAMPLE_RATE,
    updatedAt: deps.clock.nowIso(),
    lines: [...toManifestLines(synthesized, request.gapMs)],
  };

  const manifestPath = await runVoiceStage('persist', voiceScriptManifestPath(), () =>
    writeVoiceScriptManifest(deps, request.project, manifest),
  );

  return {
    source: 'script',
    manifestPath,
    storyboardId: null,
    voiceId: model.id,
    language,
    scenes: [],
    track: {
      path: trackPath,
      wordsPath,
      durationMs: manifest.durationMs,
      lineCount: manifest.lines.length,
      gapMs: request.gapMs,
    },
  };
}
