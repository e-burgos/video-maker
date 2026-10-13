import { toAbsolutePath } from '@video-maker/auto-montage';
import type { MediaProject } from '@video-maker/auto-montage';
import { parseMotionStoryboard } from '@video-maker/motion-graphics';

import type { BrandWrittenName, ProjectBrandContext } from '../brands/project-brand-context';
import type { AiAgentRequest, RenderApiDependencies } from '../deps/render-api-dependencies';
import { PipelineStageError } from '../errors/pipeline-stage-error';
import {
  PUBLISH_DESCRIPTION_MAX_LENGTH,
  PUBLISH_TAGS_MAX_TOTAL_LENGTH,
  PUBLISH_TITLE_MAX_LENGTH,
} from '../jobs/publish-job-params';
import { readStoryboardIfUsable } from '../storyboard/storyboard-store';
import { readStoredVoiceScriptManifest } from '../voice/voice-store';
import { appendCreditsOnce } from './publish-credits';
import { SHORT_MAX_DURATION_SEC } from './youtube-constants';

export const DRAFT_MAX_TAGS = 15;
export const SHORTS_HASHTAG = '#Shorts';
const SCRIPT_MAX_CHARS = 6000;
const MOTION_STORYBOARD_PATH = 'motion/storyboard.json';

export interface YoutubeDraft {
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
}

export interface YoutubeDraftInput {
  readonly project: MediaProject;
  readonly mode: 'motion' | 'footage';
  readonly brand: ProjectBrandContext | null;
  readonly durationSec: number;
  readonly width: number;
  readonly height: number;
  readonly credits: string | null;
}

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function restoreWrittenNames(text: string, names: readonly BrandWrittenName[]): string {
  return names.reduce(
    (current, name) => current.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeForPattern(name.spoken)}(?![\\p{L}\\p{N}])`, 'giu'), name.written),
    text,
  );
}

export function isShortVideo(width: number, height: number, durationSec: number): boolean {
  return height > width && durationSec <= SHORT_MAX_DURATION_SEC;
}

export function youtubeDraftJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', description: `Video title, at most ${String(PUBLISH_TITLE_MAX_LENGTH)} characters.` },
      description: { type: 'string', description: 'Video description: two to four short paragraphs.' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        maxItems: DRAFT_MAX_TAGS,
        description: 'Search tags without the # sign.',
      },
    },
    required: ['title', 'description', 'tags'],
    additionalProperties: false,
  };
}

export function buildYoutubeDraftSystemPrompt(): string {
  return [
    'You write the YouTube metadata (title, description, tags) of a finished video.',
    'Write in Spanish as spoken in Argentina (rioplatense, voseo), warm and direct.',
    `The title has at most ${String(PUBLISH_TITLE_MAX_LENGTH)} characters, states what the video is about, and is never clickbait: no invented promises, no ALL CAPS, no more than one emoji.`,
    'The description has two to four short paragraphs: what the video shows, why it matters, and a closing line. Mention the brand tagline and website when they are given. Do not invent facts that are not in the script.',
    'The script is written for a text-to-speech voice and may spell names as they sound (for example "Isi Pro" for "Easy Pro"): write every product and brand name as it appears in the on-screen text.',
    `Give at most ${String(DRAFT_MAX_TAGS)} tags, specific to the topic, lowercase, without the # sign.`,
    'Answer only with the JSON object that matches the requested schema.',
  ].join('\n');
}

export function buildYoutubeDraftUserPrompt(input: YoutubeDraftInput, script: string): string {
  const brandLines =
    input.brand === null
      ? ['Brand: none']
      : [
          `Brand name: ${input.brand.name}`,
          `Brand tagline: ${input.brand.tagline}`,
          `Brand website: ${input.brand.url ?? 'none'}`,
        ];
  const short = isShortVideo(input.width, input.height, input.durationSec);
  return [
    ...brandLines,
    `Duration: ${String(Math.round(input.durationSec))} seconds`,
    `Format: ${short ? 'vertical short (YouTube Shorts)' : 'standard video'}`,
    `Script of the video:\n${script === '' ? '(no script available, infer the topic from the brand)' : script}`,
  ].join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseDraftOutput(json: unknown): { title: string; description: string; tags: string[] } | null {
  if (!isRecord(json) || typeof json.title !== 'string' || typeof json.description !== 'string') {
    return null;
  }
  if (json.title.trim() === '' || !Array.isArray(json.tags) || json.tags.some((tag) => typeof tag !== 'string')) {
    return null;
  }
  return { title: json.title, description: json.description, tags: json.tags as string[] };
}

function withShortsHashtag(title: string): string {
  if (/#shorts/iu.test(title)) {
    return title;
  }
  const suffix = ` ${SHORTS_HASHTAG}`;
  return `${title.slice(0, PUBLISH_TITLE_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`;
}

export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  let total = 0;
  for (const raw of tags) {
    const tag = raw.replace(/^#+/u, '').trim();
    const key = tag.toLowerCase();
    if (tag === '' || seen.has(key) || kept.length >= DRAFT_MAX_TAGS || total + tag.length > PUBLISH_TAGS_MAX_TOTAL_LENGTH) {
      continue;
    }
    seen.add(key);
    kept.push(tag);
    total += tag.length;
  }
  return kept;
}

function withBrandUrl(description: string, brand: ProjectBrandContext | null): string {
  const url = brand?.url ?? null;
  if (url === null || description.includes(url)) {
    return description;
  }
  return `${description.trimEnd()}\n\n${url}`;
}

export function finalizeDraft(
  output: { title: string; description: string; tags: string[] },
  input: YoutubeDraftInput,
): YoutubeDraft {
  const short = isShortVideo(input.width, input.height, input.durationSec);
  const names = input.brand?.writtenNames ?? [];
  const restored = {
    title: restoreWrittenNames(output.title, names),
    description: restoreWrittenNames(output.description, names),
    tags: output.tags.map((tag) => restoreWrittenNames(tag, names)),
  };
  const baseTitle = restored.title.trim().slice(0, PUBLISH_TITLE_MAX_LENGTH).trimEnd();
  const description = appendCreditsOnce(withBrandUrl(restored.description.trim(), input.brand), input.credits);
  return {
    title: short ? withShortsHashtag(baseTitle) : baseTitle,
    description: description.slice(0, PUBLISH_DESCRIPTION_MAX_LENGTH),
    tags: normalizeTags(restored.tags),
  };
}

async function readMotionScript(deps: RenderApiDependencies, project: MediaProject): Promise<string> {
  const path = toAbsolutePath(project, MOTION_STORYBOARD_PATH);
  if ((await deps.storage.stat(path)) === null) {
    return '';
  }
  try {
    const storyboard = parseMotionStoryboard(JSON.parse(await deps.storage.readTextFile(path)));
    const narration = [storyboard.title, ...storyboard.scenes.map((scene) => scene.vo)].join('\n');
    const onScreen = [...new Set(storyboard.scenes.flatMap((scene) => onScreenTextsOf(scene.props)))];
    return onScreen.length === 0 ? narration : `${narration}\nOn-screen text:\n${onScreen.join('\n')}`;
  } catch {
    return '';
  }
}

const ON_SCREEN_TEXT_PROPS: readonly string[] = ['title', 'subtitle', 'headline', 'kicker', 'text', 'caption', 'label', 'name'];

function stringsAt(record: Record<string, unknown>, keys: readonly string[]): string[] {
  return keys.flatMap((key) => {
    const value = record[key];
    return typeof value === 'string' && value.trim() !== '' ? [value.trim()] : [];
  });
}

export function onScreenTextsOf(props: unknown): string[] {
  if (!isRecord(props)) {
    return [];
  }
  const steps = Array.isArray(props.steps) ? props.steps.filter(isRecord) : [];
  const items = Array.isArray(props.items) ? props.items.filter(isRecord) : [];
  return [...stringsAt(props, ON_SCREEN_TEXT_PROPS), ...steps.flatMap((step) => stringsAt(step, ['text'])), ...items.flatMap((item) => stringsAt(item, ON_SCREEN_TEXT_PROPS))];
}

async function readFootageScript(deps: RenderApiDependencies, project: MediaProject): Promise<string> {
  const storyboard = await readStoryboardIfUsable(deps, project);
  if (storyboard !== null) {
    return [storyboard.title, ...storyboard.scenes.map((scene) => scene.narration)].join('\n');
  }
  try {
    const manifest = await readStoredVoiceScriptManifest(deps, project);
    return manifest.lines.map((line) => line.text).join('\n');
  } catch {
    return '';
  }
}

export async function collectProjectScript(
  deps: RenderApiDependencies,
  project: MediaProject,
  mode: 'motion' | 'footage',
): Promise<string> {
  const script = mode === 'motion' ? await readMotionScript(deps, project) : await readFootageScript(deps, project);
  return script.slice(0, SCRIPT_MAX_CHARS);
}

function invalidOutput(): PipelineStageError {
  return new PipelineStageError({
    code: 'AI_AGENT_INVALID_OUTPUT',
    stage: null,
    resource: 'ai-agent',
    expected: 'an object with title, description and tags',
  });
}

export async function draftYoutubeMetadata(
  deps: RenderApiDependencies,
  input: YoutubeDraftInput,
): Promise<YoutubeDraft> {
  const writtenNames = input.brand?.writtenNames ?? [];
  const script = restoreWrittenNames(await collectProjectScript(deps, input.project, input.mode), writtenNames);
  const baseRequest: AiAgentRequest = {
    systemPrompt: buildYoutubeDraftSystemPrompt(),
    userPrompt: buildYoutubeDraftUserPrompt(input, script),
    jsonSchema: youtubeDraftJsonSchema(),
    model: null,
  };

  const first = parseDraftOutput((await deps.aiAgent(baseRequest)).json);
  if (first !== null) {
    return finalizeDraft(first, input);
  }

  const repairRequest: AiAgentRequest = {
    ...baseRequest,
    userPrompt: `${baseRequest.userPrompt}\n\nYour previous answer did not match the schema. Answer again with an object that has a non-empty title string, a description string and a tags array of strings.`,
  };
  const second = parseDraftOutput((await deps.aiAgent(repairRequest)).json);
  if (second === null) {
    throw invalidOutput();
  }
  return finalizeDraft(second, input);
}
