import type { StoryboardDocument } from '@video-maker/timeline-core';

import type { StoryboardInventory } from './collect-storyboard-inventory';

export interface StoryboardPromptInput {
  readonly brief: string | null;
  readonly scriptText: string | null;
  readonly inventory: StoryboardInventory;
}

const SYSTEM_PROMPT_LINES = [
  'You are the storyboard writer of a local video studio for social media.',
  'You turn an idea, or an already written script, into an ordered list of scenes.',
  '',
  'How the studio works, and why every field matters:',
  '- The narration of each scene is later synthesised as a voice-over, so write it as spoken language.',
  '- The visualPrompt of each scene is copied by hand into an external image or video generator.',
  '  That generator has no memory of the other scenes, so every prompt must be self-contained and must',
  '  repeat, verbatim, the visual description of every character it shows. That repetition is the only',
  '  thing that keeps a character consistent across separately generated shots.',
  '- Use visualSource remotion-scene whenever the beat does not need generated footage: a title card, a',
  '  block of body copy, a code snippet, or a still photo with a slow Ken Burns zoom. Prefer it for',
  '  anything textual or technical: it renders natively, costs the user nothing and always looks sharp.',
  '- Use visualSource asset only for an asset id that appears in the project inventory below.',
  '- Use visualSource upload for a beat the user has to generate outside the studio.',
  '- Even a remotion-scene keeps a visualPrompt: it documents what the beat shows.',
  '',
  'Rules:',
  '- Write every human-readable field in the language of the request, not in English.',
  '- Keep the narration of a scene under about thirty spoken words.',
  '- estimatedDurationMs is a rough guess; the studio replaces it with the real voice duration later.',
  '- musicTags and sfxTags are lowercase English words used to search a stock audio library.',
  '- Answer only with the structured payload. No prose, no explanation, no markdown.',
];

export function buildStoryboardSystemPrompt(): string {
  return SYSTEM_PROMPT_LINES.join('\n');
}

function inventorySection(inventory: StoryboardInventory): readonly string[] {
  if (inventory.assets.length === 0) {
    return ['# Project inventory', 'The project has no catalogued assets: no scene may use visualSource asset.'];
  }

  return [
    '# Project inventory',
    'Assets already available in this project. Only these ids may be used with visualSource asset.',
    ...inventory.assets.map(
      (asset) => `- ${asset.id} (role: ${asset.role}, kind: ${asset.kind}, duration: ${asset.durationMs} ms)`,
    ),
  ];
}

function transcriptSection(inventory: StoryboardInventory): readonly string[] {
  if (inventory.transcript === null) {
    return [];
  }
  return [
    '',
    '# Transcript of the footage already recorded',
    'Use it to stay consistent with what the presenter already said.',
    inventory.transcript,
  ];
}

function previousStoryboardSection(previous: StoryboardDocument | null): readonly string[] {
  if (previous === null) {
    return [];
  }
  return [
    '',
    '# Previous storyboard',
    'The user asked to regenerate it. Keep what still works, especially the character descriptions.',
    JSON.stringify(
      {
        title: previous.title,
        language: previous.language,
        format: previous.format,
        captionsStyle: previous.captionsStyle,
        characters: previous.characters.map((character) => ({
          name: character.name,
          visualDescription: character.visualDescription,
        })),
        scenes: previous.scenes.map((scene) => ({
          narration: scene.narration,
          visualPrompt: scene.visualPrompt,
          visualSource: scene.visualSource,
        })),
      },
      null,
      2,
    ),
  ];
}

function requestSection(input: StoryboardPromptInput): readonly string[] {
  if (input.scriptText !== null) {
    return [
      '# Task',
      'Split the script below into scenes without rewriting it. Keep the wording of the script as the',
      'narration of each scene, splitting only where a visual change belongs. Write the storyboard in the',
      'language the script is written in.',
      '',
      '# Script',
      input.scriptText,
    ];
  }

  return [
    '# Task',
    'Write a storyboard for the idea below. Write it in the language the idea is written in.',
    '',
    '# Idea',
    input.brief ?? '',
  ];
}

export function buildStoryboardUserPrompt(input: StoryboardPromptInput): string {
  return [
    ...requestSection(input),
    '',
    ...inventorySection(input.inventory),
    ...transcriptSection(input.inventory),
    ...previousStoryboardSection(input.inventory.previousStoryboard),
  ].join('\n');
}
