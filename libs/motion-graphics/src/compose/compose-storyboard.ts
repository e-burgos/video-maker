import { brandImageFile } from '../brand/brand-manifest';
import type { BrandManifest } from '../brand/brand-manifest';
import { MotionStudioError } from '../errors/motion-studio-error';
import { renderScene } from '../scenes/render-scene';
import { esc } from '../scenes/scene-html';
import type { SceneContext } from '../scenes/scene-html';
import { iconSprite } from '../scenes/icons';
import type { MotionStoryboard, MotionStoryboardScene } from '../storyboard/motion-storyboard.schema';

export const MOTION_COMPOSITION_ID = 'motion';
export const BRAND_ASSET_DIR = 'assets/brand';
export const RUNTIME_ASSET_DIR = 'assets/runtime';

const DEFAULT_MIN_BARS: Partial<Record<MotionStoryboardScene['kind'], number>> = { cta: 5, 'brand-reveal': 3, gallery: 4 };

export interface ScriptDocument {
  voice: string;
  lengthScale: number;
  music: { file: string; credit: string; volume?: number } | null;
  noWhooshOn: string[];
  scenes: Array<{ id: string; vo: string; minBars: number; anchor?: number }>;
  sfx: Array<{ id: string; scene: string; offset: number }>;
}

export interface ComposedStoryboard {
  template: string;
  script: ScriptDocument;
  images: string[];
  musicSource: string | null;
}

export function brandImageUrl(ref: string, brand?: BrandManifest): string {
  if (!ref.startsWith('brand:')) return ref;
  const key = ref.slice('brand:'.length);
  return `${BRAND_ASSET_DIR}/${(brand === undefined ? undefined : brandImageFile(brand, key)) ?? key}`;
}

const BRAND_REF_PREFIX = 'brand:';

function collectImages(value: unknown, found: Set<string>, includeBrandRefs: boolean): void {
  if (Array.isArray(value)) {
    value.forEach((v) => collectImages(v, found, includeBrandRefs));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const wanted = (ref: string) => includeBrandRefs || !ref.startsWith(BRAND_REF_PREFIX);
  for (const [key, v] of Object.entries(value)) {
    if ((key === 'src' || key === 'image') && typeof v === 'string' && wanted(v)) found.add(v);
    else if (key === 'images' && Array.isArray(v)) v.filter((i): i is string => typeof i === 'string' && wanted(i)).forEach((i) => found.add(i));
    else collectImages(v, found, includeBrandRefs);
  }
}

function collectBrandPhotoKeys(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((v) => collectBrandPhotoKeys(v, found));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, v] of Object.entries(value)) {
    const refs = (key === 'src' || key === 'image') && typeof v === 'string' ? [v] : key === 'images' && Array.isArray(v) ? v : null;
    if (refs === null) collectBrandPhotoKeys(v, found);
    else refs.filter((ref): ref is string => typeof ref === 'string' && ref.startsWith(BRAND_REF_PREFIX)).forEach((ref) => found.add(ref.slice(BRAND_REF_PREFIX.length)));
  }
}

function assertBrandPhotosExist(storyboard: MotionStoryboard, brand: BrandManifest): void {
  const keys = new Set<string>();
  collectBrandPhotoKeys(storyboard.scenes, keys);
  const missing = [...keys].find((key) => brandImageFile(brand, key) === undefined);
  if (missing !== undefined) {
    throw new MotionStudioError('ASSET_MISSING', `brand photo "${missing}" is not in the brand kit of "${brand.id}" (available: ${Object.keys(brand.images).join(', ')})`);
  }
}

export function storyboardImages(storyboard: MotionStoryboard): string[] {
  const found = new Set<string>();
  collectImages(storyboard.scenes, found, false);
  return [...found].sort();
}

export function storyboardSceneImageRefs(scene: MotionStoryboardScene): string[] {
  const found = new Set<string>();
  collectImages(scene, found, true);
  return [...found].sort();
}

function resolveMusic(storyboard: MotionStoryboard, brand: BrandManifest) {
  if (storyboard.music === null) return null;
  const track = brand.music.find((m) => m.id === storyboard.music?.track || m.file === storyboard.music?.track);
  if (track === undefined) throw new MotionStudioError('ASSET_MISSING', `brand "${brand.id}" has no music track "${storyboard.music.track}"`);
  return track;
}

function fontFaces(brand: BrandManifest): string {
  return brand.fonts.map((f) => `@font-face { font-family: "${f.family}"; src: url("${BRAND_ASSET_DIR}/${f.file}") format("woff2"); font-weight: ${f.weight ?? '100 900'}; }`).join('\n      ');
}

export function composeStoryboard(storyboard: MotionStoryboard, brand: BrandManifest): ComposedStoryboard {
  if (storyboard.brand !== brand.id) throw new MotionStudioError('BRAND_INVALID', `storyboard asks for brand "${storyboard.brand}" but "${brand.id}" was given`);
  assertBrandPhotosExist(storyboard, brand);
  const vertical = storyboard.format === '9:16';
  const ctx: SceneContext = { brand, format: storyboard.format, imageUrl: (ref) => brandImageUrl(ref, brand) };
  const track = resolveMusic(storyboard, brand);
  const dropScene = storyboard.scenes.find((s) => s.anchor === 'drop');

  const sections = storyboard.scenes
    .map((scene) => {
      const flash = scene.anchor === 'drop' && storyboard.beatSync ? ' data-flash="1"' : '';
      const chapter = scene.chapter ? ` data-chapter="${esc(scene.chapter)}"` : scene.kind === 'cta' ? ' data-chapter-end="1"' : '';
      return `<section id="s-${scene.id}" class="clip scene" data-scene="${scene.id}"${chapter}${flash} data-start="{{start:${scene.id}}}" data-duration="{{dur:${scene.id}}}" data-track-index="1">
        <div class="scene-in">${renderScene(scene, ctx)}</div>
      </section>`;
    })
    .join('\n      ');

  const sfx = dropScene && track
    ? `<audio id="sfx-riser" src="${RUNTIME_ASSET_DIR}/sfx/riser.mp3" data-start="{{sfx:riser}}" data-duration="3.4" data-media-start="6.6" data-track-index="12" data-volume="0.55"></audio>
      <audio id="sfx-impact" src="${RUNTIME_ASSET_DIR}/sfx/impact-bass-1.mp3" data-start="{{start:${dropScene.id}}}" data-duration="2" data-track-index="13" data-volume="0.8"></audio>`
    : '';

  const width = vertical ? 1080 : 1920;
  const height = vertical ? 1920 : 1080;
  const template = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${esc(storyboard.title)}</title>
    <script src="${RUNTIME_ASSET_DIR}/gsap.min.js"></script>
    <script src="${RUNTIME_ASSET_DIR}/motion-runtime.js"></script>
    <link rel="stylesheet" href="${BRAND_ASSET_DIR}/${brand.css}" />
    <link rel="stylesheet" href="${RUNTIME_ASSET_DIR}/scenes.css" />
    <style>
      ${fontFaces(brand)}
    </style>
  </head>
  <body>
    ${iconSprite()}
    <div id="root" class="fmt-${vertical ? '9x16' : '16x9'}" data-composition-id="${MOTION_COMPOSITION_ID}" data-start="0" data-width="${width}" data-height="${height}" data-duration="{{duration}}">
      <div class="mg-layer" data-layout-allow-overflow>
        <div class="mg-bg"></div>
        <div class="mg-dots" id="mg-dots"></div>
        <div class="mg-glow" id="mg-glow-a"></div>
        <div class="mg-glow b" id="mg-glow-b"></div>
      </div>
      ${sections}
      <div class="mg-layer" id="mg-hud">
        <div id="mg-bug"><img src="${BRAND_ASSET_DIR}/${brand.isotipo}" alt="" /><span>${esc(brand.name)}</span></div>
        <div id="mg-chapter"></div>
        <div id="mg-ticks"><i></i><i></i><i></i><i></i></div>
      </div>
      <div id="mg-flash"></div>
      <div class="mg-layer mg-vignette"></div>
      <div id="mg-progress"></div>
      {{music_track}}
      {{voice_tracks}}
      {{whoosh_tracks}}
      ${sfx}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["${MOTION_COMPOSITION_ID}"] = createMotionRuntime({{timeline_json}}, {{words_json}}, "${MOTION_COMPOSITION_ID}");
    </script>
  </body>
</html>
`;

  const voice = storyboard.voice ?? brand.voice;
  const script: ScriptDocument = {
    voice: voice.id,
    lengthScale: voice.lengthScale,
    music: track ? { file: track.file.split('/').pop() ?? track.file, credit: track.credit, ...(storyboard.music?.volume === undefined ? {} : { volume: storyboard.music.volume }) } : null,
    noWhooshOn: dropScene ? [dropScene.id] : [],
    scenes: storyboard.scenes.map((scene) => {
      const anchor = scene.anchor === 'drop' ? track?.drop : scene.anchor;
      return {
        id: scene.id,
        vo: scene.vo,
        minBars: scene.minBars ?? DEFAULT_MIN_BARS[scene.kind] ?? 3,
        ...(anchor === undefined || !storyboard.beatSync ? {} : { anchor }),
      };
    }),
    sfx: dropScene && track ? [{ id: 'riser', scene: dropScene.id, offset: -3.4 }] : [],
  };

  return { template, script, images: storyboardImages(storyboard), musicSource: track ? `${BRAND_ASSET_DIR}/${track.file}` : null };
}
