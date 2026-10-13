import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { hasVoiceDirection, parseVoiceScriptLines, VoiceDirectionSchema } from '@video-maker/timeline-core';
import type { StoryboardDocument, VoiceDirection, VoiceScriptDirections } from '@video-maker/timeline-core';
import { z } from 'zod';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import {
  parseVoiceDirections,
  readVoiceDirections,
  writeVoiceDirections,
} from '../../voice/voice-direction-store';
import { readStoredStoryboard, writeStoryboard } from '../../storyboard/storyboard-store';
import { voiceDirectionPath } from '../../voice/voice-paths';
import { readStoredVoiceScriptManifest } from '../../voice/voice-store';
import { JSON_CONTENT_TYPE } from '../http-message';
import type { HttpRequestLine, HttpResponse } from '../http-message';
import { MAX_JSON_BODY_BYTES, readJsonBody } from '../read-json-body';
import type { RouteParams } from '../router';

const PRODUCER_SCRIPT_PATH = 'work/producer/script.txt';

export interface VoiceDirectionLine {
  readonly index: number;
  readonly text: string;
}

export interface VoiceDirectionBody {
  readonly slug: string;
  readonly path: string;
  readonly directions: VoiceScriptDirections;
  readonly lines: readonly VoiceDirectionLine[];
  readonly sceneDirections?: Readonly<Record<string, VoiceDirection>>;
}

async function readVoicedLines(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<readonly VoiceDirectionLine[]> {
  try {
    const manifest = await readStoredVoiceScriptManifest(deps, project);
    return manifest.lines.map((line) => ({ index: line.index, text: line.text }));
  } catch {
    return readProducerScriptLines(deps, project);
  }
}

async function readProducerScriptLines(
  deps: RenderApiDependencies,
  project: MediaProject,
): Promise<readonly VoiceDirectionLine[]> {
  const absolutePath = toAbsolutePath(project, PRODUCER_SCRIPT_PATH);
  if ((await deps.storage.stat(absolutePath)) === null) {
    return [];
  }
  return parseVoiceScriptLines(await deps.storage.readTextFile(absolutePath)).map((line, position) => ({
    index: position + 1,
    text: line.text,
  }));
}

async function buildBody(
  deps: RenderApiDependencies,
  project: MediaProject,
  slug: string,
  directions: VoiceScriptDirections,
  sceneDirections?: Readonly<Record<string, VoiceDirection>>,
): Promise<VoiceDirectionBody> {
  return {
    slug,
    path: voiceDirectionPath(),
    directions,
    lines: await readVoicedLines(deps, project),
    ...(sceneDirections === undefined ? {} : { sceneDirections }),
  };
}

export async function handleGetVoiceDirection(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);
  const project = await resolveExistingProject(deps, store, slug);

  const body = await buildBody(deps, project, slug, await readVoiceDirections(deps, project));
  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}

const SceneDirectionsSchema = z.record(z.string().min(1), VoiceDirectionSchema.nullable());

type SceneDirectionsInput = z.infer<typeof SceneDirectionsSchema>;

interface DirectionRequest {
  readonly directions: VoiceScriptDirections | null;
  readonly sceneDirections: SceneDirectionsInput | null;
}

function invalidInput(resource: string, expected: string): PipelineStageError {
  return new PipelineStageError({ code: 'INVALID_INPUT', stage: null, resource, expected });
}

function directionRequestFrom(value: unknown): DirectionRequest {
  const body = typeof value === 'object' && value !== null ? (value as { directions?: unknown; sceneDirections?: unknown }) : {};
  if (body.directions === undefined && body.sceneDirections === undefined) {
    throw invalidInput(
      'directions',
      'a JSON object { directions?: { "<line number>": VoiceDirection }, sceneDirections?: { "<sceneId>": VoiceDirection | null } }',
    );
  }
  const scenes = body.sceneDirections === undefined ? null : SceneDirectionsSchema.safeParse(body.sceneDirections);
  if (scenes !== null && !scenes.success) {
    throw invalidInput(
      'sceneDirections',
      `an object keyed by scene id with voice directions or null: ${scenes.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`,
    );
  }
  return {
    directions: body.directions === undefined ? null : parseVoiceDirections(body.directions),
    sceneDirections: scenes === null ? null : scenes.data,
  };
}

function assertSceneDirectionsFit(document: StoryboardDocument, sceneDirections: SceneDirectionsInput): void {
  for (const [sceneId, direction] of Object.entries(sceneDirections)) {
    const scene = document.scenes.find((candidate) => candidate.id === sceneId);
    if (scene === undefined) {
      throw invalidInput(`sceneDirections.${sceneId}`, `a scene id of the storyboard: ${document.scenes.map((candidate) => candidate.id).join(', ')}`);
    }
    const narration = scene.narration.toLowerCase();
    const missing = (direction?.emphasis ?? []).find((word) => !narration.includes(word.toLowerCase()));
    if (missing !== undefined) {
      throw invalidInput(`sceneDirections.${sceneId}.emphasis`, `words that appear in the narration of ${sceneId}; "${missing}" does not`);
    }
  }
}

function withSceneDirections(document: StoryboardDocument, sceneDirections: SceneDirectionsInput): StoryboardDocument {
  return {
    ...document,
    scenes: document.scenes.map((scene) => {
      if (!(scene.id in sceneDirections)) {
        return scene;
      }
      const withoutDirection = { ...scene };
      delete withoutDirection.direction;
      const next = sceneDirections[scene.id];
      return next !== null && next !== undefined && hasVoiceDirection(next) ? { ...withoutDirection, direction: next } : withoutDirection;
    }),
  };
}

function directionsOfScenes(document: StoryboardDocument): Readonly<Record<string, VoiceDirection>> {
  return Object.fromEntries(document.scenes.flatMap((scene) => (scene.direction === undefined ? [] : [[scene.id, scene.direction]])));
}

async function applySceneDirections(
  deps: RenderApiDependencies,
  project: MediaProject,
  sceneDirections: SceneDirectionsInput,
): Promise<Readonly<Record<string, VoiceDirection>>> {
  const document = await readStoredStoryboard(deps, project);
  assertSceneDirectionsFit(document, sceneDirections);
  const updated = withSceneDirections(document, sceneDirections);
  await writeStoryboard(deps, project, updated);
  return directionsOfScenes(updated);
}

export async function handlePutVoiceDirection(
  deps: RenderApiDependencies,
  store: StoreConfig,
  params: RouteParams,
  request: HttpRequestLine,
): Promise<HttpResponse> {
  const slug = params.slug ?? '';
  assertValidProjectSlug(slug);

  const bodyResult = await readJsonBody(request.body.stream(), MAX_JSON_BODY_BYTES);
  const input = directionRequestFrom(bodyResult.kind === 'parsed' ? bodyResult.value : undefined);

  const project = await resolveExistingProject(deps, store, slug);
  const sceneDirections =
    input.sceneDirections === null ? undefined : await applySceneDirections(deps, project, input.sceneDirections);
  if (input.directions !== null) {
    await writeVoiceDirections(deps, project, input.directions);
  }

  const directions = input.directions ?? (await readVoiceDirections(deps, project));
  const body = await buildBody(deps, project, slug, directions, sceneDirections);
  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}
