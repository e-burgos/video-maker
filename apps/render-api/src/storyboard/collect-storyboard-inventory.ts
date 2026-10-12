import {
  catalogPath,
  readCatalog,
  toAbsolutePath,
} from '@video-maker/auto-montage';
import type {
  AssetRole,
  MediaProject,
  TranscriptRef,
} from '@video-maker/auto-montage';
import { TranscriptionSchema } from '@video-maker/timeline-core';
import type { MediaKind, StoryboardDocument } from '@video-maker/timeline-core';

import type { RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import { readStoryboardIfUsable } from './storyboard-store';

export interface StoryboardInventoryAsset {
  readonly id: string;
  readonly role: AssetRole;
  readonly kind: MediaKind;
  readonly durationMs: number;
}

export interface StoryboardInventory {
  readonly assets: readonly StoryboardInventoryAsset[];
  readonly transcript: string | null;
  readonly previousStoryboard: StoryboardDocument | null;
}

export const EMPTY_STORYBOARD_INVENTORY: StoryboardInventory = {
  assets: [],
  transcript: null,
  previousStoryboard: null,
};

async function readCatalogIfPresent(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<Awaited<ReturnType<typeof readCatalog>>> {
  const relativePath = catalogPath();
  if (
    (await deps.storage.stat(toAbsolutePath(project, relativePath))) === null
  ) {
    return null;
  }

  try {
    return await readCatalog(project, {
      readTextFile: deps.storage.readTextFile,
    });
  } catch (cause) {
    throw new PipelineStageError({
      code: 'CATALOG_UNREADABLE',
      stage: null,
      resource: relativePath,
      cause,
    });
  }
}

async function readTranscriptText(
  deps: RenderApiDependencies,
  project: MediaProject,
  transcript: TranscriptRef,
): Promise<string | null> {
  const absolutePath = toAbsolutePath(project, transcript.transcriptPath);
  if ((await deps.storage.stat(absolutePath)) === null) {
    return null;
  }

  try {
    const parsed = TranscriptionSchema.safeParse(
      JSON.parse(await deps.storage.readTextFile(absolutePath)),
    );
    if (!parsed.success) {
      return null;
    }
    const text = parsed.data.segments
      .map((segment) => segment.text.trim())
      .filter((segment) => segment.length > 0)
      .join(' ');
    return text.length === 0 ? null : text;
  } catch {
    return null;
  }
}

export async function collectStoryboardInventory(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<StoryboardInventory> {
  const catalog = await readCatalogIfPresent(deps, project);
  const previousStoryboard = await readStoryboardIfUsable(deps, project);

  if (catalog === null) {
    return { assets: [], transcript: null, previousStoryboard };
  }

  const assets = catalog.assets
    .filter((entry) => entry.role !== 'reference')
    .map((entry) => ({
      id: entry.asset.id,
      role: entry.role,
      kind: entry.asset.kind,
      durationMs: entry.asset.durationMs,
    }));

  const transcriptTexts: string[] = [];
  for (const transcript of catalog.transcripts) {
    const text = await readTranscriptText(deps, project, transcript);
    if (text !== null) {
      transcriptTexts.push(text);
    }
  }

  return {
    assets,
    transcript:
      transcriptTexts.length === 0 ? null : transcriptTexts.join('\n\n'),
    previousStoryboard,
  };
}
