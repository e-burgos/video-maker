import { VoiceDirectionSchema } from '@video-maker/timeline-core';
import type { MusicMode, VoiceDirection } from '@video-maker/timeline-core';

import { MotionStudioError } from '../errors/motion-studio-error';

export const DEFAULT_MUSIC_VOLUME = 0.5;

export interface MotionScene {
  id: string;
  vo: string;
  minBars: number;
  anchor: number | null;
  direction?: VoiceDirection;
}

export interface MotionSfx {
  id: string;
  scene: string;
  word: string | null;
  offset: number;
}

export interface MotionScript {
  voice: string;
  lengthScale: number;
  music: { file: string; credit: string; volume?: number; mode?: MusicMode; floorDb?: number } | null;
  noWhooshOn: string[];
  scenes: MotionScene[];
  sfx: MotionSfx[];
}

const SCENE_ID = /^[a-z][a-z0-9-]*$/u;

function fail(reason: string): never {
  throw new MotionStudioError('SCRIPT_INVALID', `script.json: ${reason}`);
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${where} must be an object`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${where} must be a non-empty string`);
  return value;
}

function asNumber(value: unknown, where: string, fallback: number | null = null): number {
  if (value === undefined && fallback !== null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${where} must be a finite number`);
  return value;
}

function parseDirection(raw: unknown, where: string): { direction?: VoiceDirection } {
  if (raw === undefined) return {};
  const parsed = VoiceDirectionSchema.safeParse(raw);
  if (!parsed.success) fail(`${where} is not a valid voice direction: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  return { direction: parsed.data };
}

function parseScene(raw: unknown, index: number): MotionScene {
  const scene = asRecord(raw, `scenes[${index}]`);
  const id = asString(scene['id'], `scenes[${index}].id`);
  if (!SCENE_ID.test(id)) fail(`scenes[${index}].id "${id}" must be kebab-case`);
  const minBars = asNumber(scene['minBars'], `scenes[${index}].minBars`, 2);
  if (minBars <= 0) fail(`scenes[${index}].minBars must be positive`);
  const anchor = scene['anchor'] === undefined ? null : asNumber(scene['anchor'], `scenes[${index}].anchor`);
  return {
    id,
    vo: asString(scene['vo'], `scenes[${index}].vo`),
    minBars,
    anchor,
    ...parseDirection(scene['direction'], `scenes[${index}].direction`),
  };
}

function parseSfx(raw: unknown, index: number, sceneIds: Set<string>): MotionSfx {
  const sfx = asRecord(raw, `sfx[${index}]`);
  const scene = asString(sfx['scene'], `sfx[${index}].scene`);
  if (!sceneIds.has(scene)) fail(`sfx[${index}].scene "${scene}" is not a scene id`);
  return {
    id: asString(sfx['id'], `sfx[${index}].id`),
    scene,
    word: sfx['word'] === undefined ? null : asString(sfx['word'], `sfx[${index}].word`),
    offset: asNumber(sfx['offset'], `sfx[${index}].offset`, 0),
  };
}

function parseMusicMode(raw: unknown): { mode?: MusicMode } {
  if (raw === undefined) return {};
  if (raw !== 'bed' && raw !== 'segments') fail('music.mode must be "bed" or "segments"');
  return { mode: raw };
}

function parseMusic(music: Record<string, unknown>): NonNullable<MotionScript['music']> {
  return {
    file: asString(music['file'], 'music.file'),
    credit: asString(music['credit'], 'music.credit'),
    ...(music['volume'] === undefined ? {} : { volume: asNumber(music['volume'], 'music.volume', DEFAULT_MUSIC_VOLUME) }),
    ...parseMusicMode(music['mode']),
    ...(music['floorDb'] === undefined ? {} : { floorDb: asNumber(music['floorDb'], 'music.floorDb') }),
  };
}

export function parseMotionScript(raw: unknown): MotionScript {
  const script = asRecord(raw, 'root');
  const music = script['music'] === null ? null : asRecord(script['music'], 'music');
  if (!Array.isArray(script['scenes']) || script['scenes'].length === 0) fail('scenes must be a non-empty array');
  const scenes = script['scenes'].map(parseScene);
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  if (sceneIds.size !== scenes.length) fail('scene ids must be unique');
  const rawSfx = script['sfx'] ?? [];
  if (!Array.isArray(rawSfx)) fail('sfx must be an array');
  const noWhooshOn = script['noWhooshOn'] ?? [];
  if (!Array.isArray(noWhooshOn) || noWhooshOn.some((id) => typeof id !== 'string')) fail('noWhooshOn must be a list of scene ids');
  return {
    voice: asString(script['voice'], 'voice'),
    lengthScale: asNumber(script['lengthScale'], 'lengthScale', 1),
    music: music === null ? null : parseMusic(music),
    noWhooshOn: noWhooshOn as string[],
    scenes,
    sfx: rawSfx.map((entry, index) => parseSfx(entry, index, sceneIds)),
  };
}
