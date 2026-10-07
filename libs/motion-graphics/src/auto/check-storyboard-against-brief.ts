import type { BrandManifest } from '../brand/brand-manifest';
import type { MotionStoryboard } from '../storyboard/motion-storyboard.schema';
import { briefImageRef } from './motion-brief';
import type { MotionBrief } from './motion-brief';

export interface StoryboardIssue {
  path: string;
  message: string;
}

const BRAND_PREFIX = 'brand:';

export function enforceBrief(raw: unknown, brief: MotionBrief): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const answer = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'voice'));
  const enforced: Record<string, unknown> = { ...answer, version: 1, brand: brief.brand, format: brief.format, beatSync: brief.beatSync };
  if (brief.title !== undefined) enforced['title'] = brief.title;
  if (brief.music === null) enforced['music'] = null;
  else if (brief.music !== 'auto') enforced['music'] = { track: brief.music };
  return enforced;
}

function normalizeWord(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function wordsOf(text: string): string[] {
  return normalizeWord(text).split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
}

function isCueKey(key: string): boolean {
  return key === 'cue' || key.endsWith('Cue');
}

interface Reference {
  path: string;
  kind: 'cue' | 'image' | 'device';
  value: string;
}

function collectReferences(value: unknown, path: string, found: Reference[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === 'string' && path.endsWith('.images')) found.push({ path: `${path}[${index}]`, kind: 'image', value: item });
      else collectReferences(item, `${path}[${index}]`, found);
    });
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (typeof child === 'string') {
      if (isCueKey(key)) found.push({ path: childPath, kind: 'cue', value: child });
      else if (key === 'src' || key === 'image') found.push({ path: childPath, kind: 'image', value: child });
      else if (key === 'device') found.push({ path: childPath, kind: 'device', value: child });
    } else collectReferences(child, childPath, found);
  }
}

export function checkStoryboardAgainstBrief(storyboard: MotionStoryboard, brief: MotionBrief, brand: BrandManifest): StoryboardIssue[] {
  const issues: StoryboardIssue[] = [];
  const briefImages = new Set(brief.images.map((image) => briefImageRef(image.file)));

  if (storyboard.music !== null && !brand.music.some((track) => track.id === storyboard.music?.track || track.file === storyboard.music?.track)) {
    issues.push({ path: 'music.track', message: `track "${storyboard.music.track}" is not in the brand music (${brand.music.map((track) => track.id).join(', ')})` });
  }

  storyboard.scenes.forEach((scene, index) => {
    const scenePath = `scenes[${index}]`;
    const voiceWords = wordsOf(scene.vo);
    const references: Reference[] = [];
    collectReferences(scene.props, `${scenePath}.props`, references);
    for (const { path, kind, value } of references) {
      if (kind === 'cue' && !voiceWords.some((word) => word.startsWith(normalizeWord(value.trim())))) {
        issues.push({ path, message: `cue "${value}" is not the start of any word of the scene "${scene.id}" vo` });
      } else if (kind === 'device' && brand.devices[value] === undefined) {
        issues.push({ path, message: `device "${value}" is not in the brand devices (${Object.keys(brand.devices).join(', ')})` });
      } else if (kind === 'image') {
        const known = value.startsWith(BRAND_PREFIX) ? brand.images[value.slice(BRAND_PREFIX.length)] !== undefined : briefImages.has(value);
        if (!known) issues.push({ path, message: `image "${value}" is neither listed in the brief nor a brand image (${Object.keys(brand.images).map((key) => `${BRAND_PREFIX}${key}`).join(', ')})` });
      }
    }
  });
  return issues;
}
