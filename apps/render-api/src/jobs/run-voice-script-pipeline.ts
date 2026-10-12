import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import {
  VOICE_SCRIPT_MANIFEST_SCHEMA_VERSION,
  hasVoiceDirection,
  hasVoiceScriptTimeMarks,
  parseVoiceScriptLines,
  planVoiceScriptPlacements,
  voiceDirectionSynthesis,
} from '@video-maker/timeline-core';
import type {
  ParsedVoiceScriptLine,
  VoiceDirection,
  VoiceScriptLine,
  VoiceScriptManifest,
  VoiceScriptPlacement,
} from '@video-maker/timeline-core';

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
} from '../voice/voice-paths';
import {
  mergeVoiceScriptLineWords,
  transcribeVoiceScriptLine,
} from '../voice/transcribe-voice-script-lines';
import type { VoiceScriptLineWords } from '../voice/transcribe-voice-script-lines';
import { whisperLanguageFor } from '../voice/voice-language';
import {
  ensureVoiceDirectories,
  resolveVoiceModel,
  synthesisLengthScale,
  runVoiceStage,
} from '../voice/voice-synthesis-steps';
import type { BrandVoice, ResolvedVoiceModel } from '../voice/voice-synthesis-steps';
import { readVoiceDirections } from '../voice/voice-direction-store';
import { writeVoiceScriptManifest, writeVoiceWords } from '../voice/voice-store';
import type { VoiceJobReport } from './render-job';
import { voiceCheckpoint } from './voice-pipeline-observer';
import type { VoicePipelineObserver } from './voice-pipeline-observer';

export interface VoiceScriptPipelineRequest {
  readonly project: MediaProject;
  readonly voiceId: string | null;
  readonly scriptText: string | null;
  readonly scriptPath: string | null;
  readonly gapMs: number;
  readonly brandVoice?: BrandVoice | null;
}

interface SynthesizedLine {
  readonly index: number;
  readonly text: string;
  readonly path: string;
  readonly durationMs: number;
  readonly requestedStartMs: number | null;
  readonly requestedEndMs: number | null;
  readonly lengthScale: number;
  readonly direction?: VoiceDirection;
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

function assertScriptHasLines(
  lines: readonly ParsedVoiceScriptLine[],
  resource: string | null,
): void {
  if (lines.length === 0) {
    throw new PipelineStageError({
      code: 'VOICE_SCRIPT_INVALID',
      stage: 'synthesize',
      resource,
      expected: 'a script with at least one non-empty line',
    });
  }
}

interface LineToSynthesize {
  readonly text: string;
  readonly requestedStartMs: number | null;
  readonly requestedEndMs: number | null;
  readonly direction?: VoiceDirection;
}

function pauseOf(line: { readonly direction?: VoiceDirection }): number {
  return voiceDirectionSynthesis(line.direction).trailingPauseMs;
}

async function synthesizeLine(
  index: number,
  line: LineToSynthesize,
  lengthScale: number,
  model: ResolvedVoiceModel,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<SynthesizedLine> {
  const lineId = voiceScriptLineId(index);
  const textPath = voiceNarrationTextPath(lineId);
  const wavPath = voiceSourceWavPath(lineId);
  const { lengthScaleFactor, noiseScale, noiseScaleW, trailingPauseMs } = voiceDirectionSynthesis(line.direction);
  const directedScale = synthesisLengthScale(model, lengthScale * lengthScaleFactor);

  await deps.storage.writeTextFile(toAbsolutePath(project, textPath), `${line.text}\n`);

  await deps.synthesizeVoice({
    textPath: toAbsolutePath(project, textPath),
    outPath: toAbsolutePath(project, wavPath),
    modelPath: model.path,
    projectRoot: project.root,
    ...(directedScale === 1 ? {} : { lengthScale: directedScale }),
    ...(noiseScale === undefined ? {} : { noiseScale }),
    ...(noiseScaleW === undefined ? {} : { noiseScaleW }),
    ...(trailingPauseMs > 0 ? { trailingPauseMs } : {}),
  });

  const probed = await deps.probeAsset({ path: toAbsolutePath(project, wavPath), assetId: wavPath });

  return {
    index,
    text: line.text,
    path: wavPath,
    durationMs: probed.durationMs,
    requestedStartMs: line.requestedStartMs,
    requestedEndMs: line.requestedEndMs,
    lengthScale,
    ...(hasVoiceDirection(line.direction) ? { direction: line.direction } : {}),
  };
}

function directionOf(direction: VoiceDirection | undefined): { direction?: VoiceDirection } {
  return hasVoiceDirection(direction) ? { direction } : {};
}

function toPlacementRequests(lines: readonly SynthesizedLine[], timed: boolean) {
  return lines.map((line) => ({
    requestedStartMs: line.requestedStartMs,
    requestedEndMs: line.requestedEndMs,
    durationMs: timed ? line.durationMs - pauseOf(line) : line.durationMs,
  }));
}

function toManifestLines(
  lines: readonly SynthesizedLine[],
  placements: readonly VoiceScriptPlacement[],
  lineWords: readonly VoiceScriptLineWords[],
): readonly VoiceScriptLine[] {
  return lines.map((line, position) => {
    const placement = placements[position] as VoiceScriptPlacement;
    return {
      index: line.index,
      text: line.text,
      path: line.path,
      startMs: placement.startMs,
      durationMs: line.durationMs,
      endMs: placement.endMs,
      requestedStartMs: placement.requestedStartMs,
      overflowMs: placement.overflowMs,
      ...(line.lengthScale === 1 ? {} : { lengthScale: line.lengthScale }),
      ...(line.direction === undefined ? {} : { direction: line.direction }),
      ...(lineWords[position] === undefined ? {} : { wordsSource: lineWords[position].source }),
    };
  });
}

function declaredWindowEndMs(
  lines: readonly SynthesizedLine[],
  placements: readonly VoiceScriptPlacement[],
): number | null {
  const declaredEndMs = Math.max(
    0,
    ...lines.map((line) => line.requestedEndMs ?? 0),
  );
  const narrationEndMs = Math.max(0, ...placements.map((placement) => placement.endMs));

  return declaredEndMs > narrationEndMs ? declaredEndMs : null;
}

async function fitTimedLinesIntoTheirWindows(
  lines: readonly SynthesizedLine[],
  gapMs: number,
  model: ResolvedVoiceModel,
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<readonly SynthesizedLine[]> {
  const planned = planVoiceScriptPlacements(toPlacementRequests(lines, true), { gapMs });
  const fitted: SynthesizedLine[] = [];

  for (const [position, line] of lines.entries()) {
    const lengthScale = planned[position]?.lengthScale ?? 1;
    fitted.push(
      lengthScale === 1
        ? line
        : await runVoiceStage('synthesize', voiceScriptLineId(line.index), () =>
            synthesizeLine(line.index, line, lengthScale, model, deps, project),
          ),
    );
  }

  return fitted;
}

export async function runVoiceScriptPipeline(
  request: VoiceScriptPipelineRequest,
  deps: RenderApiDependencies,
  observer: VoicePipelineObserver,
): Promise<VoiceJobReport> {
  const scriptText = await runVoiceStage('synthesize', request.scriptPath, () =>
    resolveScriptText(request, deps),
  );
  const lines = parseVoiceScriptLines(scriptText);
  assertScriptHasLines(lines, request.scriptPath);
  const timed = hasVoiceScriptTimeMarks(lines);

  const model = await runVoiceStage('synthesize', null, () => resolveVoiceModel(deps, request.voiceId, request.brandVoice ?? null));
  const language = voiceLanguageFromModelId(model.id);

  await runVoiceStage('synthesize', null, () => ensureVoiceDirectories(deps, request.project));

  const directions = await runVoiceStage('synthesize', null, () => readVoiceDirections(deps, request.project));

  voiceCheckpoint(observer, 'synthesize');
  observer.stageStarted('synthesize');

  const synthesized: SynthesizedLine[] = [];
  for (const [position, line] of lines.entries()) {
    voiceCheckpoint(observer, 'synthesize');
    synthesized.push(
      await runVoiceStage('synthesize', voiceScriptLineId(position + 1), () =>
        synthesizeLine(position + 1, { ...line, ...directionOf(directions[String(position + 1)]) }, 1, model, deps, request.project),
      ),
    );
    observer.sceneProcessed('synthesize', synthesized.length, lines.length);
  }

  const fitted = timed
    ? await fitTimedLinesIntoTheirWindows(
        synthesized,
        request.gapMs,
        model,
        deps,
        request.project,
      )
    : synthesized;

  const placements = planVoiceScriptPlacements(toPlacementRequests(fitted, timed), {
    gapMs: request.gapMs,
    allowSpeedUp: false,
  });

  const trackPath = voiceScriptTrackPath();

  await runVoiceStage('synthesize', trackPath, () =>
    timed
      ? deps.placeVoiceTracks({
          segments: fitted.map((line, position) => ({
            path: toAbsolutePath(request.project, line.path),
            startMs: placements[position]?.startMs ?? 0,
          })),
          totalMs: declaredWindowEndMs(fitted, placements),
          outPath: toAbsolutePath(request.project, trackPath),
          sampleRate: VOICE_TRACK_SAMPLE_RATE,
          channels: VOICE_TRACK_CHANNELS,
          projectRoot: request.project.root,
        })
      : deps.concatVoiceTracks({
          inputPaths: fitted.map((line) => toAbsolutePath(request.project, line.path)),
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

  const lineWords: VoiceScriptLineWords[] = [];
  for (const [position, line] of fitted.entries()) {
    voiceCheckpoint(observer, 'transcribe');
    const placement = placements[position] as VoiceScriptPlacement;
    lineWords.push(
      await transcribeVoiceScriptLine(
        {
          lineId: voiceScriptLineId(line.index),
          text: line.text,
          path: line.path,
          startMs: placement.startMs,
          endMs: placement.endMs,
        },
        language,
        deps,
        request.project,
      ),
    );
    observer.sceneProcessed('transcribe', lineWords.length, fitted.length);
  }

  const wordsPath = await runVoiceStage('transcribe', trackPath, () =>
    writeVoiceWords(
      deps,
      request.project,
      voiceScriptWordsPath(),
      mergeVoiceScriptLineWords(trackPath, whisperLanguageFor(language), lineWords),
    ),
  );

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
    lines: [...toManifestLines(fitted, placements, lineWords)],
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
