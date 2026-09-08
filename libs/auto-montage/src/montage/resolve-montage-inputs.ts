import type { MediaAsset, OutputFormat, OutputPreset, Transcription } from '@video-maker/timeline-core';
import { TranscriptionSchema, defaultFormat } from '@video-maker/timeline-core';
import type { ReadTextFile } from '@video-maker/media-local';

import type { Catalog } from '../catalog/catalog.schema';
import { MontageInputError } from '../errors/montage-input-error';
import type { MediaProject } from '../project/media-project';
import { toAbsolutePath } from '../project/project-paths';

export type TranscriptionSource = 'catalog' | 'missing' | 'unreadable';

export interface ResolveMontageInputsOptions {
  readonly arollAssetId?: string;
  readonly musicAssetId?: string;
  readonly outputPreset?: OutputPreset;
}

export interface ResolveMontageInputsDependencies {
  readonly readTextFile: ReadTextFile;
}

export interface ResolvedMontageInputs {
  readonly arollAsset: MediaAsset;
  readonly musicAsset: MediaAsset | undefined;
  readonly transcription: Transcription;
  readonly transcriptionSource: TranscriptionSource;
  readonly format: OutputFormat;
}

const EMPTY_TRANSCRIPTION_LANGUAGE = 'en';

function compareAssetIdAscending(left: Catalog['assets'][number], right: Catalog['assets'][number]): number {
  return left.asset.id < right.asset.id ? -1 : 1;
}

function findAsset(
  catalog: Catalog,
  role: Catalog['assets'][number]['role'],
  assetId: string,
): MediaAsset | undefined {
  return catalog.assets.find((entry) => entry.role === role && entry.asset.id === assetId)?.asset;
}

function firstAssetByRole(catalog: Catalog, role: Catalog['assets'][number]['role']): MediaAsset | undefined {
  return [...catalog.assets]
    .filter((entry) => entry.role === role)
    .sort(compareAssetIdAscending)[0]?.asset;
}

function resolveArollAsset(
  project: MediaProject,
  catalog: Catalog,
  arollAssetId: string | undefined,
): MediaAsset {
  if (arollAssetId !== undefined) {
    const found = findAsset(catalog, 'aroll', arollAssetId);
    if (found === undefined) {
      throw new MontageInputError({ projectRoot: project.root, reason: 'aroll-asset-not-found' });
    }
    return found;
  }

  const found = firstAssetByRole(catalog, 'aroll');
  if (found === undefined) {
    throw new MontageInputError({ projectRoot: project.root, reason: 'no-aroll-asset' });
  }
  return found;
}

function resolveMusicAsset(
  project: MediaProject,
  catalog: Catalog,
  musicAssetId: string | undefined,
): MediaAsset | undefined {
  if (musicAssetId !== undefined) {
    const found = findAsset(catalog, 'audio', musicAssetId);
    if (found === undefined) {
      throw new MontageInputError({ projectRoot: project.root, reason: 'music-asset-not-found' });
    }
    return found;
  }

  return firstAssetByRole(catalog, 'audio');
}

function emptyTranscription(arollAssetId: string): Transcription {
  return {
    assetId: arollAssetId,
    engine: 'whisper.cpp',
    language: EMPTY_TRANSCRIPTION_LANGUAGE,
    words: [],
    segments: [],
  };
}

async function readTranscription(
  project: MediaProject,
  catalog: Catalog,
  arollAssetId: string,
  readTextFile: ReadTextFile,
): Promise<{ transcription: Transcription; source: TranscriptionSource }> {
  const ref = catalog.transcripts.find((transcript) => transcript.assetId === arollAssetId);
  if (ref === undefined) {
    return { transcription: emptyTranscription(arollAssetId), source: 'missing' };
  }

  let raw: string;
  try {
    raw = await readTextFile(toAbsolutePath(project, ref.transcriptPath));
  } catch {
    return { transcription: emptyTranscription(arollAssetId), source: 'unreadable' };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { transcription: emptyTranscription(arollAssetId), source: 'unreadable' };
  }

  const result = TranscriptionSchema.safeParse(parsedJson);
  if (!result.success) {
    return { transcription: emptyTranscription(arollAssetId), source: 'unreadable' };
  }

  return { transcription: result.data, source: 'catalog' };
}

export async function resolveMontageInputs(
  project: MediaProject,
  catalog: Catalog,
  options: ResolveMontageInputsOptions,
  deps: ResolveMontageInputsDependencies,
): Promise<ResolvedMontageInputs> {
  const arollAsset = resolveArollAsset(project, catalog, options.arollAssetId);
  const musicAsset = resolveMusicAsset(project, catalog, options.musicAssetId);
  const { transcription, source } = await readTranscription(
    project,
    catalog,
    arollAsset.id,
    deps.readTextFile,
  );

  return {
    arollAsset,
    musicAsset,
    transcription,
    transcriptionSource: source,
    format: defaultFormat(options.outputPreset ?? 'reels-9x16'),
  };
}
