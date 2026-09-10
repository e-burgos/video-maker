import type {
  MediaAsset,
  MusicInput,
  TranscriptWord,
  Word,
  OutputFormat,
  SceneAssignment,
  SceneWords,
  StoryboardDocument,
  Timeline,
  VoiceManifest,
} from '@video-maker/timeline-core';
import {
  SceneAssignmentSchema,
  StoryboardDocumentSchema,
  TranscriptionSchema,
  VoiceManifestSchema,
  buildTimelineFromStoryboard,
  defaultFormat,
} from '@video-maker/timeline-core';
import type { ReadTextFile } from '@video-maker/media-local';

import type { Catalog, ProjectRelativePath } from '../catalog/catalog.schema';
import { readCatalog } from '../catalog/read-catalog';
import { AssembleInputError } from '../errors/assemble-input-error';
import type { EnsureDirectory } from '../fs/ensure-directory';
import type { WriteTextFile } from '../fs/write-text-file';
import { assertValidTimeline } from '../montage/assert-valid-timeline';
import { writeTimeline } from '../montage/write-timeline';
import type { MediaProject } from '../project/media-project';
import {
  sceneAssignmentPath,
  storyboardDocumentPath,
  timelinePath as storedTimelinePath,
  toAbsolutePath,
  voiceManifestPath,
} from '../project/project-paths';
import { outputPresetFor } from './storyboard-format';

export interface AssembleDependencies {
  readonly readTextFile: ReadTextFile;
  readonly writeTextFile: WriteTextFile;
  readonly ensureDirectory: EnsureDirectory;
}

export interface AssembleOptions {
  readonly musicAssetId?: string | undefined;
  readonly scenePaddingMs?: number | undefined;
  readonly persist?: boolean | undefined;
}

export interface AssembleInputs {
  readonly storyboard: StoryboardDocument;
  readonly format: OutputFormat;
  readonly assets: readonly MediaAsset[];
  readonly voice: VoiceManifest | undefined;
  readonly assignment: SceneAssignment | undefined;
  readonly words: readonly SceneWords[];
}

export interface AssembleResult {
  readonly timeline: Timeline;
  readonly timelinePath: ProjectRelativePath;
  readonly storyboardId: string;
  readonly format: OutputFormat;
  readonly sceneCount: number;
  readonly scenesWithVoice: number;
  readonly scenesWithoutVoice: readonly string[];
  readonly scenesWithoutVisual: readonly string[];
}

async function readOptionalJson(
  deps: AssembleDependencies,
  absolutePath: string,
): Promise<unknown | undefined> {
  let raw: string;
  try {
    raw = await deps.readTextFile(absolutePath);
  } catch {
    return undefined;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function readStoryboard(
  project: MediaProject,
  deps: AssembleDependencies,
): Promise<StoryboardDocument> {
  const relativePath = storyboardDocumentPath();
  const parsedJson = await readOptionalJson(deps, toAbsolutePath(project, relativePath));

  if (parsedJson === undefined) {
    throw new AssembleInputError({ reason: 'storyboard-missing', resource: relativePath });
  }

  const result = StoryboardDocumentSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new AssembleInputError({ reason: 'storyboard-invalid', resource: relativePath });
  }

  return result.data;
}

async function readVoiceManifest(
  project: MediaProject,
  deps: AssembleDependencies,
): Promise<VoiceManifest | undefined> {
  const relativePath = voiceManifestPath();
  const parsedJson = await readOptionalJson(deps, toAbsolutePath(project, relativePath));

  if (parsedJson === undefined) {
    return undefined;
  }

  const result = VoiceManifestSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new AssembleInputError({ reason: 'voice-invalid', resource: relativePath });
  }

  return result.data;
}

async function readAssignment(
  project: MediaProject,
  deps: AssembleDependencies,
): Promise<SceneAssignment | undefined> {
  const relativePath = sceneAssignmentPath();
  const parsedJson = await readOptionalJson(deps, toAbsolutePath(project, relativePath));

  if (parsedJson === undefined) {
    return undefined;
  }

  const result = SceneAssignmentSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new AssembleInputError({ reason: 'assignment-invalid', resource: relativePath });
  }

  return result.data;
}

function toTranscriptWord(word: Word): TranscriptWord {
  return word.confidence === undefined
    ? { text: word.text, startMs: word.startMs, endMs: word.endMs }
    : { text: word.text, startMs: word.startMs, endMs: word.endMs, confidence: word.confidence };
}

async function readSceneWords(
  project: MediaProject,
  deps: AssembleDependencies,
  voice: VoiceManifest | undefined,
): Promise<SceneWords[]> {
  const words: SceneWords[] = [];

  for (const track of voice?.tracks ?? []) {
    const parsedJson = await readOptionalJson(deps, toAbsolutePath(project, track.wordsPath));
    if (parsedJson === undefined) {
      continue;
    }

    const result = TranscriptionSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new AssembleInputError({ reason: 'words-invalid', resource: track.wordsPath });
    }

    words.push({ sceneId: track.sceneId, words: result.data.words.map(toTranscriptWord) });
  }

  return words;
}

function voiceAssetsOf(voice: VoiceManifest | undefined): MediaAsset[] {
  return (voice?.tracks ?? []).map((track) => ({
    id: track.path,
    kind: 'audio',
    path: track.path,
    durationMs: track.durationMs,
    hasAudio: true,
    audio: { sampleRate: track.sampleRate, channels: 1, codec: 'pcm_s16le' },
    probedAt: track.updatedAt,
  }));
}

function catalogAssetsOf(catalog: Catalog): MediaAsset[] {
  return catalog.assets.map((entry) => entry.asset);
}

function musicInputOf(assets: readonly MediaAsset[], musicAssetId: string | undefined): MusicInput | undefined {
  if (musicAssetId === undefined) {
    return undefined;
  }
  return assets.some((asset) => asset.id === musicAssetId) ? { assetId: musicAssetId } : undefined;
}

export async function collectAssembleInputs(
  project: MediaProject,
  deps: AssembleDependencies,
): Promise<AssembleInputs> {
  const storyboard = await readStoryboard(project, deps);

  const catalog = await readCatalog(project, { readTextFile: deps.readTextFile });
  if (catalog === null) {
    throw new AssembleInputError({ reason: 'catalog-missing', resource: 'work/catalog.json' });
  }

  const voice = await readVoiceManifest(project, deps);
  const assignment = await readAssignment(project, deps);
  const words = await readSceneWords(project, deps, voice);

  return {
    storyboard,
    format: defaultFormat(outputPresetFor(storyboard.format)),
    assets: [...catalogAssetsOf(catalog), ...voiceAssetsOf(voice)],
    voice,
    assignment,
    words,
  };
}

export function buildAssembledTimeline(
  inputs: AssembleInputs,
  options: AssembleOptions = {},
): Omit<AssembleResult, 'timelinePath'> {
  const result = buildTimelineFromStoryboard({
    storyboard: inputs.storyboard,
    format: inputs.format,
    assets: inputs.assets,
    words: inputs.words,
    ...(inputs.voice === undefined ? {} : { voice: inputs.voice }),
    ...(inputs.assignment === undefined ? {} : { assignment: inputs.assignment }),
    ...(options.scenePaddingMs === undefined ? {} : { scenePaddingMs: options.scenePaddingMs }),
    ...(() => {
      const music = musicInputOf(inputs.assets, options.musicAssetId);
      return music === undefined ? {} : { music };
    })(),
  });

  assertValidTimeline(result.timeline);

  return {
    timeline: result.timeline,
    storyboardId: inputs.storyboard.id,
    format: inputs.format,
    sceneCount: inputs.storyboard.scenes.length,
    scenesWithVoice: inputs.voice?.tracks.length ?? 0,
    scenesWithoutVoice: result.scenesWithoutVoice,
    scenesWithoutVisual: result.scenesWithoutVisual,
  };
}

export async function persistAssembledTimeline(
  project: MediaProject,
  deps: AssembleDependencies,
  timeline: Timeline,
): Promise<ProjectRelativePath> {
  return writeTimeline(project, timeline, {
    writeTextFile: deps.writeTextFile,
    ensureDirectory: deps.ensureDirectory,
  });
}

export async function assembleFromStoryboard(
  project: MediaProject,
  deps: AssembleDependencies,
  options: AssembleOptions = {},
): Promise<AssembleResult> {
  const inputs = await collectAssembleInputs(project, deps);
  const built = buildAssembledTimeline(inputs, options);

  const timelinePath =
    options.persist === false
      ? storedTimelinePath()
      : await persistAssembledTimeline(project, deps, built.timeline);

  return { ...built, timelinePath };
}
