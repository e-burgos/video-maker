import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { parseVoiceScriptLines } from '@video-maker/timeline-core';
import type { VoiceScriptDirections } from '@video-maker/timeline-core';

import type { StoreConfig } from '../../config/store-config';
import type { RenderApiDependencies } from '../../deps/render-api-dependencies';
import { PipelineStageError } from '../../errors/pipeline-stage-error';
import { assertValidProjectSlug, resolveExistingProject } from '../../store/project-scope';
import {
  parseVoiceDirections,
  readVoiceDirections,
  writeVoiceDirections,
} from '../../voice/voice-direction-store';
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
): Promise<VoiceDirectionBody> {
  return { slug, path: voiceDirectionPath(), directions, lines: await readVoicedLines(deps, project) };
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

function directionsFrom(value: unknown): VoiceScriptDirections {
  const directions = typeof value === 'object' && value !== null ? (value as { directions?: unknown }).directions : undefined;
  if (directions === undefined) {
    throw new PipelineStageError({
      code: 'INVALID_INPUT',
      stage: null,
      resource: 'directions',
      expected: 'a JSON object { directions: { "<line number>": VoiceDirection } }',
    });
  }
  return parseVoiceDirections(directions);
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
  const directions = directionsFrom(bodyResult.kind === 'parsed' ? bodyResult.value : undefined);

  const project = await resolveExistingProject(deps, store, slug);
  await writeVoiceDirections(deps, project, directions);

  const body = await buildBody(deps, project, slug, directions);
  return { status: 200, headers: { 'content-type': JSON_CONTENT_TYPE }, body };
}
