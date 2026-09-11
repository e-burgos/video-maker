import type {
  CaptionStyle,
  EditDecisionList,
  LogoInput,
  MediaAsset,
  MusicInput,
  OutputPreset,
  Timeline,
} from '@video-maker/timeline-core';
import {
  buildTimeline,
  captionGroupingForStyle,
  framesToMs,
  planPunchIns,
  remapMsAfterCuts,
  stripVoiceScriptTimeMarks,
} from '@video-maker/timeline-core';
import type { ReadTextFile } from '@video-maker/media-local';
import { nodeReadTextFile } from '@video-maker/media-local';

import { buildBrollIndex } from './broll/build-broll-index';
import type { BrollOverlayPlan, BrollRejection } from './broll/plan-broll-overlays';
import { planBrollOverlays } from './broll/plan-broll-overlays';
import type { ProjectRelativePath } from './catalog/catalog.schema';
import { readCatalog } from './catalog/read-catalog';
import type { Concept } from './concepts/concept';
import { spotConcepts } from './concepts/spot-concepts';
import { MontageInputError } from './errors/montage-input-error';
import { assertValidEditDecisionList } from './montage/assert-valid-edl';
import { assertValidTimeline } from './montage/assert-valid-timeline';
import { buildEditDecisionList } from './montage/build-edit-decision-list';
import { planCaptionGroups } from './montage/plan-caption-groups';
import { planDuckRanges } from './montage/plan-duck-ranges';
import { planTransitions } from './montage/plan-transitions';
import type { TranscriptionSource } from './montage/resolve-montage-inputs';
import { resolveMontageInputs } from './montage/resolve-montage-inputs';
import { writeEditDecisionList } from './montage/write-edit-decision-list';
import { writeTimeline } from './montage/write-timeline';
import type { MontagePreset, MontagePresetName } from './presets/montage-preset';
import { captionStyleForMontagePreset } from './presets/caption-style-defaults';
import { resolveMontagePreset } from './presets/preset-registry';
import type { MediaProject } from './project/media-project';
import { editDecisionListPath, timelinePath } from './project/project-paths';
import { pruneSilencesWithFrameMargin } from './montage/prune-silences-with-frame-margin';
import type { ScriptAlignmentCounts, ScriptAlignmentResult } from './transcript/align-transcript-to-script';
import { alignTranscriptToScript } from './transcript/align-transcript-to-script';
import type { EnsureDirectory } from './fs/ensure-directory';
import { nodeEnsureDirectory } from './fs/ensure-directory';
import type { WriteTextFile } from './fs/write-text-file';
import { nodeWriteTextFile } from './fs/write-text-file';
import { readVoiceScriptTrack } from './voice/read-voice-script-track';
import type { VoiceScriptTrack } from './voice/read-voice-script-track';

export type LogoMode = 'auto' | 'off';

export type VoiceSource = 'aroll' | 'script';

export interface VoiceTrackSummary {
  readonly assetId: string;
  readonly durationMs: number;
  readonly truncatedMs: number;
}

export interface AutoMontageOptions {
  readonly preset: MontagePresetName | MontagePreset;
  readonly seed: number;
  readonly outputPreset?: OutputPreset;
  readonly arollAssetId?: string;
  readonly musicAssetId?: string;
  readonly logoAssetId?: string;
  readonly logo?: LogoMode;
  readonly scriptText?: string;
  readonly voice?: VoiceSource;
  readonly captionStyle?: CaptionStyle;
  readonly pruneSilences?: boolean;
  readonly persist?: boolean;
}

export interface MontageDependencies {
  readonly readTextFile?: ReadTextFile;
  readonly writeTextFile?: WriteTextFile;
  readonly ensureDirectory?: EnsureDirectory;
}

export interface AutoMontageResult {
  readonly edl: EditDecisionList;
  readonly timeline: Timeline;
  readonly concepts: readonly Concept[];
  readonly brollOverlays: readonly BrollOverlayPlan[];
  readonly brollRejections: readonly BrollRejection[];
  readonly transcriptionSource: TranscriptionSource;
  readonly voiceSource: VoiceSource;
  readonly voiceTrack: VoiceTrackSummary | null;
  readonly stopwordLanguage: string | null;
  readonly logoAssetId: string | null;
  readonly scriptAlignment: ScriptAlignmentCounts | null;
  readonly captionStyle: CaptionStyle;
  readonly editedDurationMs: number;
  readonly edlPath: ProjectRelativePath;
  readonly timelinePath: ProjectRelativePath;
}

function brollAssetsUsedBy(
  overlays: readonly BrollOverlayPlan[],
  catalogAssets: readonly { readonly asset: MediaAsset }[],
): MediaAsset[] {
  const usedAssetIds = new Set(overlays.map((overlay) => overlay.assetId));
  return catalogAssets
    .map((entry) => entry.asset)
    .filter((asset) => usedAssetIds.has(asset.id));
}

function toMusicInput(
  musicAsset: MediaAsset | undefined,
  preset: MontagePreset,
): MusicInput | undefined {
  return musicAsset === undefined ? undefined : { assetId: musicAsset.id, mix: { ...preset.audio } };
}

function toAlignmentCounts(alignment: ScriptAlignmentResult): ScriptAlignmentCounts {
  return {
    replaced: alignment.replaced,
    removed: alignment.removed,
    inserted: alignment.inserted,
    dropped: alignment.dropped,
    corrected: alignment.corrected,
  };
}

function toVoiceTrackSummary(
  track: VoiceScriptTrack | null,
  sourceDurationMs: number,
): VoiceTrackSummary | null {
  if (track === null) {
    return null;
  }

  const audibleEndMs = track.timed ? track.narrationEndMs : track.asset.durationMs;

  return {
    assetId: track.asset.id,
    durationMs: track.asset.durationMs,
    truncatedMs: Math.max(0, audibleEndMs - sourceDurationMs),
  };
}

function toLogoInput(logoAsset: MediaAsset | undefined): LogoInput | undefined {
  return logoAsset === undefined ? undefined : { assetId: logoAsset.id };
}

export async function autoMontage(
  project: MediaProject,
  options: AutoMontageOptions,
  deps: MontageDependencies = {},
): Promise<AutoMontageResult> {
  const readTextFile = deps.readTextFile ?? nodeReadTextFile;

  const catalog = await readCatalog(project, { readTextFile });
  if (catalog === null) {
    throw new MontageInputError({ projectRoot: project.root, reason: 'catalog-missing' });
  }

  const preset = resolveMontagePreset(options.preset, project.root);

  const { arollAsset, musicAsset, logoAsset, transcription, transcriptionSource, format } =
    await resolveMontageInputs(
      project,
      catalog,
      {
        ...(options.arollAssetId !== undefined ? { arollAssetId: options.arollAssetId } : {}),
        ...(options.musicAssetId !== undefined ? { musicAssetId: options.musicAssetId } : {}),
        ...(options.logoAssetId !== undefined ? { logoAssetId: options.logoAssetId } : {}),
        includeLogo: options.logo !== 'off',
        ...(options.outputPreset !== undefined ? { outputPreset: options.outputPreset } : {}),
      },
      { readTextFile },
    );

  const fps = format.fps;
  const voiceSource: VoiceSource = options.voice ?? 'aroll';
  const voiceScriptTrack =
    voiceSource === 'script' ? await readVoiceScriptTrack(project, { readTextFile }) : null;

  if (voiceScriptTrack !== null && voiceScriptTrack.asset.durationMs <= framesToMs(1, fps, 'ceil')) {
    throw new MontageInputError({ projectRoot: project.root, reason: 'empty-voice-track' });
  }

  const speech = voiceScriptTrack === null ? transcription : voiceScriptTrack.transcription;
  const speechSource: TranscriptionSource =
    voiceScriptTrack === null ? transcriptionSource : 'voice-script';

  const alignment =
    options.scriptText === undefined
      ? null
      : alignTranscriptToScript(speech.words, stripVoiceScriptTimeMarks(options.scriptText));
  const alignedTranscription =
    alignment === null ? speech : { ...speech, words: [...alignment.words], segments: [] };

  const sourceDurationMs =
    voiceScriptTrack === null || voiceScriptTrack.timed
      ? arollAsset.durationMs
      : Math.min(arollAsset.durationMs, voiceScriptTrack.asset.durationMs);

  const { pruneDurationMs, keeps, cuts } = pruneSilencesWithFrameMargin(
    project.root,
    alignedTranscription,
    preset,
    fps,
    { sourceDurationMs, prune: options.pruneSilences ?? voiceSource === 'aroll' },
  );

  const punchIns = planPunchIns(keeps, {
    seed: options.seed,
    every: preset.punchIn.every,
    scales: preset.punchIn.scales,
    anchor: preset.punchIn.anchor,
  });

  const { concepts, stopwordLanguage } = spotConcepts(alignedTranscription, preset);

  const brollIndex = buildBrollIndex(catalog, preset);
  const { overlays, rejections } = planBrollOverlays({
    concepts,
    index: brollIndex,
    keeps,
    punchIns,
    preset,
    fps,
  });

  const captionStyle = captionStyleForMontagePreset(preset.name, options.captionStyle);
  const captionGroups = planCaptionGroups(
    alignedTranscription.words,
    keeps,
    concepts,
    preset,
    captionGroupingForStyle(captionStyle),
  );
  const duckDecisions = planDuckRanges(alignedTranscription.words, keeps, preset, fps);
  const transitions = planTransitions(keeps, preset, fps);

  const edl = assertValidEditDecisionList(
    buildEditDecisionList({
      sourceAssetId: arollAsset.id,
      format,
      presetName: preset.name,
      seed: options.seed,
      keeps,
      cuts,
      punchIns,
      brollOverlays: overlays,
      transitions,
      captionGroups,
      duckDecisions,
    }),
  );

  const assets = [arollAsset, ...brollAssetsUsedBy(overlays, catalog.assets)];
  if (voiceScriptTrack !== null) {
    assets.push(voiceScriptTrack.asset);
  }
  if (musicAsset !== undefined) {
    assets.push(musicAsset);
  }
  if (logoAsset !== undefined) {
    assets.push(logoAsset);
  }

  const timeline = assertValidTimeline(
    buildTimeline(
      edl,
      assets,
      toMusicInput(musicAsset, preset),
      toLogoInput(logoAsset),
      voiceScriptTrack === null
        ? undefined
        : { assetId: voiceScriptTrack.asset.id, durationMs: voiceScriptTrack.asset.durationMs },
      captionStyle,
    ),
  );

  if (options.persist !== false) {
    const writeTextFile = deps.writeTextFile ?? nodeWriteTextFile;
    const ensureDirectory = deps.ensureDirectory ?? nodeEnsureDirectory;
    await writeEditDecisionList(project, edl, { writeTextFile, ensureDirectory });
    await writeTimeline(project, timeline, { writeTextFile, ensureDirectory });
  }

  return {
    edl,
    timeline,
    concepts,
    brollOverlays: overlays,
    brollRejections: rejections,
    transcriptionSource: speechSource,
    voiceSource,
    voiceTrack: toVoiceTrackSummary(voiceScriptTrack, sourceDurationMs),
    stopwordLanguage,
    logoAssetId: logoAsset?.id ?? null,
    scriptAlignment: alignment === null ? null : toAlignmentCounts(alignment),
    captionStyle,
    editedDurationMs: remapMsAfterCuts(pruneDurationMs, keeps),
    edlPath: editDecisionListPath(),
    timelinePath: timelinePath(),
  };
}
