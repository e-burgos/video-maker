import { activeDeviceIds, brandImageCaption } from '../brand/brand-manifest';
import type { BrandManifest } from '../brand/brand-manifest';
import { motionStoryboardJsonSchema } from '../storyboard/parse-motion-storyboard';
import { SCENE_KINDS } from '../storyboard/motion-storyboard.schema';
import type { MotionSceneKind } from '../storyboard/motion-storyboard.schema';
import { briefImageRef } from './motion-brief';
import type { MotionBrief } from './motion-brief';
import { SCENE_GUIDE } from './scene-guide';

export interface AutoStoryboardRequest {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
}

const MIN_SCENES = 6;
const MAX_SCENES = 12;

const MIN_GALLERY_IMAGES = 2;

function availableImageCount(brief: MotionBrief, brand: BrandManifest): number {
  return brief.images.length + Object.keys(brand.images).length;
}

function offeredSceneKinds(brief: MotionBrief, brand: BrandManifest): readonly MotionSceneKind[] {
  const hasDevices = activeDeviceIds(brand).length > 0;
  const hasGalleryImages = availableImageCount(brief, brand) >= MIN_GALLERY_IMAGES;
  return SCENE_KINDS.filter((kind) => (kind !== 'connections' || hasDevices) && (kind !== 'gallery' || hasGalleryImages) && (kind !== 'ui-walkthrough' || brief.images.length > 0));
}

function sceneGuideLines(kinds: readonly MotionSceneKind[]): string {
  return kinds.map((kind) => `- ${kind}: ${SCENE_GUIDE[kind]}`).join('\n');
}

function systemPrompt(kinds: readonly MotionSceneKind[]): string {
  return [
    'You are the storyboard director of a motion-graphics video maker. You turn a script, described photos and a brand kit into a storyboard made only of scenes from a fixed catalog.',
    'Hard rules:',
    '- Reply with ONLY a JSON object that matches the provided JSON schema. No prose, no markdown, no HTML.',
    '- The `vo` of every scene is the exact voice-over line, written in the language of the script. Split or rephrase the script so it sounds natural when spoken.',
    '- Write every number in `vo` as words (never digits). Say the brand with its spoken name and introduce it and keep talking after it, preferably "Esto es <spoken name>: …": the brand name is never the first words of a line, never its last words and never a line on its own, because the voice engine garbles it without context on both sides.',
    `- Use between ${MIN_SCENES} and ${MAX_SCENES} scenes. Start with a \`hook\` and finish with a \`cta\`. Use \`brand-reveal\` once, with \`anchor: "drop"\` when the chosen music track has a drop.`,
    '- Every `cue` must be the beginning of a word that appears in the `vo` of the same scene: the element shows up when the voice says it.',
    '- Use only the images listed in the brief (as images/<file>) or the brand images (as brand:<key>), and only the devices and music tracks of the brand. Never invent files.',
    '- Direct the voice with the optional `direction` of a scene only where the line asks for it: `pace` slow for a claim to land or fast for a list, `energy` lively for the hook and the cta or calm for reassurance, `pauseAfterMs` (0-2000) for a breath before a reveal, `emphasis` with words that appear in that same `vo`. Most lines need none: leave `direction` out of neutral lines, and never give every scene the same direction.',
    '- Leave `music.mode` out (the music runs under the voice). Set it to `segments` only when the brief asks for the music to breathe: full in the intro, the outro and the silences between lines, and very low while the voice speaks.',
    '- Keep on-screen texts short, in the language of the script, and consistent with the voice.',
    '- Never invent a URL: leave `url` out so the brand url applies. Leave `voice` out: the brand voice applies. In `brand-reveal` and `cta` leave `tagline` and `accent` out to show the brand tagline; set them only for a different phrase.',
    'Scene catalog (what each kind is for):',
    sceneGuideLines(kinds),
  ].join('\n');
}

function brandSection(brand: BrandManifest): string {
  const devices = activeDeviceIds(brand).map((id) => {
    const device = brand.devices[id];
    const spoken = device?.spokenName === undefined ? '' : `; in vo write it "${device.spokenName}"`;
    return `${id} (${device?.name}, ${device?.kind}${spoken})`;
  });
  const images = Object.keys(brand.images).map((key) => {
    const caption = brandImageCaption(brand, key);
    return caption === undefined ? `brand:${key}` : `brand:${key} (${caption})`;
  });
  const music = brand.music.map((track) => `${track.id} (${track.mood}, ${track.bpm} BPM${track.drop === undefined ? ', no drop' : `, drop at ${track.drop}s`})`);
  return [
    'BRAND',
    `name: ${brand.name}`,
    `spoken name: ${brand.spokenName}`,
    ...(brand.url === undefined ? [] : [`url: ${brand.url}`]),
    `tagline: ${brand.tagline}${brand.taglineAccent === undefined ? '' : ` ${brand.taglineAccent}`}`,
    `devices: ${devices.length === 0 ? 'none' : devices.join('; ')}`,
    `brand images: ${images.length === 0 ? 'none' : images.join('; ')}`,
    `music tracks: ${music.length === 0 ? 'none' : music.join('; ')}`,
    `voice: ${brand.voice.id}`,
  ].join('\n');
}

function assetLimitsSection(brief: MotionBrief, brand: BrandManifest): string[] {
  const limits: string[] = [];
  if (activeDeviceIds(brand).length === 0) {
    limits.push('This brand has no devices: never use a `device` visual or the `connections` scene; show products with an `icon` visual or an image instead.');
  }
  if (availableImageCount(brief, brand) === 0) {
    limits.push('There are no images at all: never use an `image` visual or screen, and build every scene from text, icons and the other visuals.');
  }
  if (brand.music.length === 0) {
    limits.push('This brand has no music tracks: use `music: null` and never set an `anchor`.');
  }
  return limits.length === 0 ? [] : ['ASSET LIMITS', ...limits.map((limit) => `- ${limit}`)];
}

function boxLines(boxes: MotionBrief['images'][number]['boxes']): string[] {
  if (boxes === undefined || boxes.length === 0) return [];
  return [
    '  measured boxes (fractions of the image; in a ui-walkthrough step write `box: "<name>"` instead of x,y,w,h, and never estimate a position these boxes already give):',
    ...boxes.map((box) => `  * "${box.name}": x ${box.x}, y ${box.y}, w ${box.w}, h ${box.h}`),
  ];
}

function briefSection(brief: MotionBrief, brand: BrandManifest): string {
  const silent = brief.music === null || (brief.music === 'auto' && brand.music.length === 0);
  const musicInstruction = silent
    ? 'no music (use music: null)'
    : brief.music === 'auto'
      ? 'choose the track that fits the mood of the script'
      : `use the track "${brief.music}"`;
  const images = brief.images.flatMap((image) => [`- ${briefImageRef(image.file)}: ${image.caption}`, ...boxLines(image.boxes)]);
  return [
    'BRIEF',
    ...(brief.title === undefined ? [] : [`title: ${brief.title}`]),
    ...(brief.goal === undefined ? [] : [`goal: ${brief.goal}`]),
    ...(brief.audience === undefined ? [] : [`audience: ${brief.audience}`]),
    `format: ${brief.format}`,
    `beat sync: ${brief.beatSync ? 'on' : 'off'}`,
    `music: ${musicInstruction}`,
    `images:${images.length === 0 ? ' none' : `\n${images.join('\n')}`}`,
  ].join('\n');
}

export function buildAutoStoryboardRequest(brief: MotionBrief, brand: BrandManifest): AutoStoryboardRequest {
  return {
    systemPrompt: systemPrompt(offeredSceneKinds(brief, brand)),
    userPrompt: [brandSection(brand), assetLimitsSection(brief, brand).join('\n'), briefSection(brief, brand), `SCRIPT\n${brief.script}`]
      .filter((section) => section !== '')
      .join('\n\n'),
    jsonSchema: motionStoryboardJsonSchema(),
  };
}
