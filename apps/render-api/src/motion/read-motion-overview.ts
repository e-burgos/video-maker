import { parseMotionStoryboard } from '@video-maker/motion-graphics';
import type { MotionStoryboard } from '@video-maker/motion-graphics';
import { join } from 'node:path/posix';

import type { ObjectStorage } from '../deps/object-storage';
import { createSampleFileClassifier } from '../jobs/sample-files';
import type { SampleFileClassifier } from '../jobs/sample-files';

const STORYBOARD_PATH = 'motion/storyboard.json';
const TIMELINE_PATH = 'work/motion/timeline.json';
const VOICE_MANIFEST_PATH = 'work/motion/voice-manifest.json';
const VOICE_DIRECTORY = 'work/motion/assets/audio';
const OUT_DIRECTORY = 'out';
const CREDITS_SUFFIX = '.credits.txt';

export interface MotionOverviewTimelineScene {
  readonly id: string;
  readonly startSec: number;
  readonly endSec: number;
  readonly voStartSec: number;
  readonly voDurationSec: number;
}

export interface MotionOverviewTimeline {
  readonly durationSec: number;
  readonly bpm: number | null;
  readonly beatSync: boolean;
  readonly musicCredit: string | null;
  readonly scenes: readonly MotionOverviewTimelineScene[];
}

export interface MotionOverviewVoiceScene {
  readonly sceneId: string;
  readonly vo: string;
  readonly voicedText: string | null;
  readonly voice: string | null;
  readonly path: string | null;
  readonly durationSec: number | null;
  readonly stale: boolean;
}

export interface MotionOverviewVideo {
  readonly path: string;
  readonly creditsPath: string | null;
  readonly credits: string | null;
  readonly modifiedAt: string;
  readonly outdated: boolean;
}

export interface MotionOverview {
  readonly storyboard: MotionStoryboard | null;
  readonly timeline: MotionOverviewTimeline | null;
  readonly voice: { readonly scenes: readonly MotionOverviewVoiceScene[] } | null;
  readonly video: MotionOverviewVideo | null;
}

interface ManifestLine {
  readonly vo: string;
  readonly voice: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function readJsonIfPresent(storage: ObjectStorage, path: string): Promise<unknown> {
  const stat = await storage.stat(path);
  if (stat === null || stat.kind !== 'file') {
    return null;
  }
  try {
    return JSON.parse(await storage.readTextFile(path));
  } catch {
    return null;
  }
}

async function readStoryboard(storage: ObjectStorage, root: string): Promise<MotionStoryboard | null> {
  const document = await readJsonIfPresent(storage, join(root, STORYBOARD_PATH));
  if (document === null) {
    return null;
  }
  try {
    return parseMotionStoryboard(document);
  } catch {
    return null;
  }
}

function toTimelineScene(raw: unknown): MotionOverviewTimelineScene | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') {
    return null;
  }
  const startSec = finiteNumber(raw.start);
  const endSec = finiteNumber(raw.end);
  if (startSec === null || endSec === null) {
    return null;
  }
  return {
    id: raw.id,
    startSec,
    endSec,
    voStartSec: finiteNumber(raw.voStart) ?? startSec,
    voDurationSec: finiteNumber(raw.voDuration) ?? 0,
  };
}

async function readTimeline(storage: ObjectStorage, root: string): Promise<MotionOverviewTimeline | null> {
  const document = await readJsonIfPresent(storage, join(root, TIMELINE_PATH));
  if (!isRecord(document) || !Array.isArray(document.scenes)) {
    return null;
  }
  const durationSec = finiteNumber(document.duration);
  if (durationSec === null) {
    return null;
  }
  return {
    durationSec,
    bpm: finiteNumber(document.bpm),
    beatSync: document.beatSync === true,
    musicCredit: typeof document.musicCredit === 'string' ? document.musicCredit : null,
    scenes: document.scenes.map(toTimelineScene).filter((scene): scene is MotionOverviewTimelineScene => scene !== null),
  };
}

async function readVoiceManifest(
  storage: ObjectStorage,
  root: string,
): Promise<ReadonlyMap<string, ManifestLine> | null> {
  const document = await readJsonIfPresent(storage, join(root, VOICE_MANIFEST_PATH));
  if (!isRecord(document)) {
    return null;
  }
  const lines = new Map<string, ManifestLine>();
  for (const [sceneId, entry] of Object.entries(document)) {
    if (isRecord(entry) && typeof entry.vo === 'string') {
      lines.set(sceneId, { vo: entry.vo, voice: typeof entry.voice === 'string' ? entry.voice : null });
    }
  }
  return lines;
}

async function buildVoiceScene(
  storage: ObjectStorage,
  root: string,
  sceneId: string,
  currentVo: string | null,
  manifest: ReadonlyMap<string, ManifestLine>,
  timeline: MotionOverviewTimeline | null,
): Promise<MotionOverviewVoiceScene> {
  const line = manifest.get(sceneId) ?? null;
  const relativePath = `${VOICE_DIRECTORY}/vo-${sceneId}.wav`;
  const stat = await storage.stat(join(root, relativePath));
  const path = stat !== null && stat.kind === 'file' ? relativePath : null;
  const vo = currentVo ?? line?.vo ?? '';
  const timelineScene = timeline?.scenes.find((scene) => scene.id === sceneId) ?? null;

  return {
    sceneId,
    vo,
    voicedText: line?.vo ?? null,
    voice: line?.voice ?? null,
    path,
    durationSec: timelineScene?.voDurationSec ?? null,
    stale: path === null || line?.vo !== vo,
  };
}

async function readVoice(
  storage: ObjectStorage,
  root: string,
  storyboard: MotionStoryboard | null,
  timeline: MotionOverviewTimeline | null,
): Promise<{ readonly scenes: readonly MotionOverviewVoiceScene[] } | null> {
  const manifest = await readVoiceManifest(storage, root);
  if (manifest === null) {
    return null;
  }
  const sources: { readonly sceneId: string; readonly vo: string | null }[] =
    storyboard === null
      ? [...manifest.keys()].map((sceneId) => ({ sceneId, vo: null }))
      : storyboard.scenes.map((scene) => ({ sceneId: scene.id, vo: scene.vo }));
  const scenes = await Promise.all(
    sources.map((source) => buildVoiceScene(storage, root, source.sceneId, source.vo, manifest, timeline)),
  );
  return { scenes };
}

async function readCredits(
  storage: ObjectStorage,
  root: string,
  videoName: string,
): Promise<{ readonly creditsPath: string | null; readonly credits: string | null }> {
  const relativePath = `${OUT_DIRECTORY}/${videoName.slice(0, -'.mp4'.length)}${CREDITS_SUFFIX}`;
  const stat = await storage.stat(join(root, relativePath));
  if (stat === null || stat.kind !== 'file') {
    return { creditsPath: null, credits: null };
  }
  return { creditsPath: relativePath, credits: (await storage.readTextFile(join(root, relativePath))).trim() };
}

async function newestVideo(
  storage: ObjectStorage,
  root: string,
  isSample: SampleFileClassifier,
): Promise<{ readonly name: string; readonly modifiedAtMs: number } | null> {
  const entries = await storage.listDirectory(join(root, OUT_DIRECTORY));
  if (entries === null) {
    return null;
  }
  const candidates = entries.filter((entry) => entry.isFile && !entry.name.startsWith('.') && entry.name.endsWith('.mp4') && !isSample(`${OUT_DIRECTORY}/${entry.name}`));
  const withTimes = await Promise.all(
    candidates.map(async (entry) => ({
      name: entry.name,
      modifiedAtMs: (await storage.stat(join(root, OUT_DIRECTORY, entry.name)))?.modifiedAtMs ?? 0,
    })),
  );
  return withTimes.reduce<{ readonly name: string; readonly modifiedAtMs: number } | null>(
    (newest, candidate) => (newest === null || candidate.modifiedAtMs > newest.modifiedAtMs ? candidate : newest),
    null,
  );
}

async function readVideo(storage: ObjectStorage, root: string, isSample: SampleFileClassifier): Promise<MotionOverviewVideo | null> {
  const newest = await newestVideo(storage, root, isSample);
  if (newest === null) {
    return null;
  }
  const storyboardStat = await storage.stat(join(root, STORYBOARD_PATH));
  const credits = await readCredits(storage, root, newest.name);
  return {
    path: `${OUT_DIRECTORY}/${newest.name}`,
    ...credits,
    modifiedAt: new Date(newest.modifiedAtMs).toISOString(),
    outdated: storyboardStat !== null && storyboardStat.modifiedAtMs > newest.modifiedAtMs,
  };
}

export async function readMotionOverview(
  storage: ObjectStorage,
  root: string,
  isSample: SampleFileClassifier = createSampleFileClassifier([]),
): Promise<MotionOverview> {
  const storyboard = await readStoryboard(storage, root);
  const timeline = await readTimeline(storage, root);
  const voice = await readVoice(storage, root, storyboard, timeline);
  const video = await readVideo(storage, root, isSample);
  return { storyboard, timeline, voice, video };
}
