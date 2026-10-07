import type { BrandManifest } from '../brand/brand-manifest';
import { motionStoryboardJsonSchema } from '../storyboard/parse-motion-storyboard';
import { SCENE_KINDS } from '../storyboard/motion-storyboard.schema';
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

function sceneGuideLines(): string {
  return SCENE_KINDS.map((kind) => `- ${kind}: ${SCENE_GUIDE[kind]}`).join('\n');
}

function systemPrompt(): string {
  return [
    'You are the storyboard director of a motion-graphics video maker. You turn a script, described photos and a brand kit into a storyboard made only of scenes from a fixed catalog.',
    'Hard rules:',
    '- Reply with ONLY a JSON object that matches the provided JSON schema. No prose, no markdown, no HTML.',
    '- The `vo` of every scene is the exact voice-over line, written in the language of the script. Split or rephrase the script so it sounds natural when spoken.',
    '- Write every number in `vo` as words (never digits). Say the brand with its spoken name and introduce it and keep talking after it, preferably "Esto es <spoken name>: …": the brand name is never the first words of a line, never its last words and never a line on its own, because the voice engine garbles it without context on both sides.',
    `- Use between ${MIN_SCENES} and ${MAX_SCENES} scenes. Start with a \`hook\` and finish with a \`cta\`. Use \`brand-reveal\` once, with \`anchor: "drop"\` when the chosen music track has a drop.`,
    '- Every `cue` must be the beginning of a word that appears in the `vo` of the same scene: the element shows up when the voice says it.',
    '- Use only the images listed in the brief (as images/<file>) or the brand images (as brand:<key>), and only the devices and music tracks of the brand. Never invent files.',
    '- Keep on-screen texts short, in the language of the script, and consistent with the voice.',
    '- Never invent a URL: leave `url` out so the brand url applies. Leave `voice` out: the brand voice applies. In `brand-reveal` and `cta` leave `tagline` and `accent` out to show the brand tagline; set them only for a different phrase.',
    'Scene catalog (what each kind is for):',
    sceneGuideLines(),
  ].join('\n');
}

function brandSection(brand: BrandManifest): string {
  const devices = Object.entries(brand.devices).map(([id, device]) => `${id} (${device.name}, ${device.kind})`);
  const images = Object.keys(brand.images).map((key) => `brand:${key}`);
  const music = brand.music.map((track) => `${track.id} (${track.mood}, ${track.bpm} BPM${track.drop === undefined ? ', no drop' : `, drop at ${track.drop}s`})`);
  return [
    'BRAND',
    `name: ${brand.name}`,
    `spoken name: ${brand.spokenName}`,
    ...(brand.url === undefined ? [] : [`url: ${brand.url}`]),
    `tagline: ${brand.tagline}${brand.taglineAccent === undefined ? '' : ` ${brand.taglineAccent}`}`,
    `devices: ${devices.length === 0 ? 'none' : devices.join('; ')}`,
    `brand images: ${images.length === 0 ? 'none' : images.join(', ')}`,
    `music tracks: ${music.join('; ')}`,
    `voice: ${brand.voice.id}`,
  ].join('\n');
}

function briefSection(brief: MotionBrief): string {
  const musicInstruction =
    brief.music === 'auto' ? 'choose the track that fits the mood of the script' : brief.music === null ? 'no music (use music: null)' : `use the track "${brief.music}"`;
  const images = brief.images.map((image) => `- ${briefImageRef(image.file)}: ${image.caption}`);
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
    systemPrompt: systemPrompt(),
    userPrompt: [brandSection(brand), briefSection(brief), `SCRIPT\n${brief.script}`].join('\n\n'),
    jsonSchema: motionStoryboardJsonSchema(),
  };
}
