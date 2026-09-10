import type { StoryboardDocument } from '@video-maker/timeline-core';
import { StoryboardDocumentSchema } from '@video-maker/timeline-core';

export const RAW_STORYBOARD: unknown = {
  schemaVersion: 1,
  id: 'storyboard-0001',
  source: 'brief',
  createdAt: '2026-09-09T12:00:00.000Z',
  title: 'Tres trucos de terminal que usás todos los días',
  language: 'es-AR',
  format: '9:16',
  captionsStyle: 'bold yellow highlight, one word at a time',
  musicTags: ['upbeat', 'tech'],
  characters: [
    {
      id: 'character-01',
      name: 'Nina',
      visualDescription:
        'Woman in her thirties, short dark curly hair, round glasses, mustard hoodie, warm studio light.',
    },
  ],
  scenes: [
    {
      id: 'scene-01',
      index: 1,
      narration: 'Hay tres comandos que te devuelven una hora por semana.',
      visualPrompt:
        'Vertical shot of Nina, woman in her thirties with short dark curly hair, round glasses and a mustard hoodie, leaning towards the camera in a dim home office.',
      visualSource: 'upload',
      estimatedDurationMs: 4200,
      musicTags: ['upbeat'],
      sfxTags: ['whoosh'],
    },
    {
      id: 'scene-02',
      index: 2,
      narration: 'El primero es fzf: busca cualquier archivo sin salir de la terminal.',
      visualPrompt: 'Close-up of a terminal window running a fuzzy finder over a long file list.',
      visualSource: 'remotion-scene',
      remotionScene: { kind: 'code', code: 'fzf --preview "bat {}"', codeLanguage: 'bash' },
      estimatedDurationMs: 5000,
      captionsStyle: 'monospace, no highlight',
      musicTags: ['tech'],
      sfxTags: ['keyboard'],
    },
    {
      id: 'scene-03',
      index: 3,
      narration: 'Guardalos en tu alias file y no los escribís nunca más.',
      visualPrompt: 'Wide shot of a tidy desk with a mechanical keyboard and a warm lamp.',
      visualSource: 'asset',
      assetId: 'broll-0001',
      estimatedDurationMs: 3800,
      musicTags: ['calm'],
      sfxTags: [],
    },
  ],
};

export function storyboardFixture(): StoryboardDocument {
  return StoryboardDocumentSchema.parse(structuredClone(RAW_STORYBOARD));
}
