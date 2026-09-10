import type { StoryboardDocument, StoryboardProposal } from '@video-maker/timeline-core';

export const STORYBOARD_CREATED_AT = '2026-09-09T12:00:00.000Z';

export function buildStoryboardProposal(overrides?: Partial<StoryboardProposal>): StoryboardProposal {
  return {
    title: 'Tres trampas de un monorepo',
    language: 'es-AR',
    format: '9:16',
    captionsStyle: 'kinetic-bold',
    musicTags: ['tense'],
    characters: [{ name: 'Ana', visualDescription: 'Woman with short black hair and red framed glasses.' }],
    scenes: [
      {
        narration: 'Trampa uno: dos package managers en el mismo repo.',
        visualPrompt: 'Ana, woman with short black hair and red framed glasses, staring at a terminal.',
        visualSource: 'upload',
        estimatedDurationMs: 5200,
        musicTags: ['tense'],
        sfxTags: ['whoosh'],
      },
      {
        narration: 'Mirá lo que pasa cuando corrés install dos veces.',
        visualPrompt: 'A terminal window with two conflicting lockfiles side by side.',
        visualSource: 'remotion-scene',
        remotionScene: { kind: 'code', code: 'pnpm install\nnpm install', codeLanguage: 'bash' },
        estimatedDurationMs: 3800,
        musicTags: ['tense'],
        sfxTags: [],
      },
      {
        narration: 'Guardate las tres y no las volvés a pagar.',
        visualPrompt: 'Closing shot of the studio desk, warm light.',
        visualSource: 'asset',
        assetId: 'raw/broll/desk.mp4',
        estimatedDurationMs: 3000,
        musicTags: ['tense'],
        sfxTags: [],
      },
    ],
    ...overrides,
  };
}

export function buildStoryboardDocument(overrides?: Partial<StoryboardDocument>): StoryboardDocument {
  return {
    schemaVersion: 1,
    id: 'storyboard-0001',
    source: 'brief',
    createdAt: STORYBOARD_CREATED_AT,
    title: 'Tres trampas de un monorepo',
    language: 'es-AR',
    format: '9:16',
    captionsStyle: 'kinetic-bold',
    musicTags: ['tense'],
    characters: [
      { id: 'character-01', name: 'Ana', visualDescription: 'Woman with short black hair and red framed glasses.' },
    ],
    scenes: [
      {
        id: 'scene-01',
        index: 1,
        narration: 'Trampa uno: dos package managers en el mismo repo.',
        visualPrompt: 'Ana, woman with short black hair and red framed glasses, staring at a terminal.',
        visualSource: 'upload',
        estimatedDurationMs: 5200,
        musicTags: ['tense'],
        sfxTags: ['whoosh'],
      },
      {
        id: 'scene-02',
        index: 2,
        narration: 'Mirá lo que pasa cuando corrés install dos veces.',
        visualPrompt: 'A terminal window with two conflicting lockfiles side by side.',
        visualSource: 'remotion-scene',
        remotionScene: { kind: 'code', code: 'pnpm install\nnpm install', codeLanguage: 'bash' },
        estimatedDurationMs: 3800,
        musicTags: ['tense'],
        sfxTags: [],
      },
      {
        id: 'scene-03',
        index: 3,
        narration: 'Guardate las tres y no las volvés a pagar.',
        visualPrompt: 'Closing shot of the studio desk, warm light.',
        visualSource: 'asset',
        assetId: 'raw/broll/desk.mp4',
        estimatedDurationMs: 3000,
        musicTags: ['tense'],
        sfxTags: [],
      },
    ],
    ...overrides,
  };
}
