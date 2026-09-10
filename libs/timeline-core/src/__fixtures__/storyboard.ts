import type { StoryboardDocument, StoryboardProposal } from '../schemas/storyboard.schema';

export const minimalStoryboardProposal: StoryboardProposal = {
  title: 'Cómo empezar con Nx',
  language: 'es-AR',
  format: '9:16',
  captionsStyle: 'kinetic-bold',
  musicTags: ['upbeat'],
  characters: [],
  scenes: [
    {
      narration: 'Nx convierte un repo suelto en un monorepo con caché.',
      visualPrompt: 'A developer laptop on a dark desk, neon accent lighting, vertical framing.',
      visualSource: 'upload',
      estimatedDurationMs: 4000,
      musicTags: ['upbeat'],
      sfxTags: [],
    },
  ],
};

export const fullStoryboardProposal: StoryboardProposal = {
  title: 'Tres trampas de un monorepo',
  language: 'es-AR',
  format: '9:16',
  captionsStyle: 'kinetic-bold',
  musicTags: ['tense', 'electronic'],
  characters: [
    { name: 'Ana', visualDescription: 'Woman in her thirties, short black hair, red framed glasses, grey hoodie.' },
    { name: 'Beto', visualDescription: 'Man in his forties, full beard, blue denim shirt, silver wristwatch.' },
  ],
  scenes: [
    {
      narration: 'Trampa uno: dos package managers en el mismo repo.',
      visualPrompt: 'Ana, woman in her thirties with short black hair and red framed glasses, staring at a terminal.',
      visualSource: 'upload',
      estimatedDurationMs: 5200,
      musicTags: ['tense'],
      sfxTags: ['whoosh'],
    },
    {
      narration: 'Mirá lo que pasa cuando corrés install dos veces.',
      visualSource: 'remotion-scene',
      visualPrompt: 'A terminal window with two conflicting lockfiles side by side.',
      remotionScene: { kind: 'code', code: 'pnpm install\nnpm install', codeLanguage: 'bash' },
      estimatedDurationMs: 3800,
      captionsStyle: 'off',
      musicTags: ['tense'],
      sfxTags: ['error'],
    },
    {
      narration: 'Trampa dos: los proyectos fuera de apps y libs.',
      visualSource: 'remotion-scene',
      visualPrompt: 'A large title card reading "packages/ no existe acá".',
      remotionScene: { kind: 'title', title: 'packages/ no existe acá', subtitle: 'apps · libs · tools' },
      estimatedDurationMs: 2600,
      musicTags: ['electronic'],
      sfxTags: [],
    },
    {
      narration: 'Trampa tres: el alias declarado en un solo resolvedor.',
      visualSource: 'remotion-scene',
      visualPrompt: 'Body copy on screen listing the three resolvers.',
      remotionScene: { kind: 'text', text: 'tsc · Vitest · el bundler' },
      estimatedDurationMs: 3100,
      musicTags: ['electronic'],
      sfxTags: [],
    },
    {
      narration: 'Beto ya lo había visto en el repo anterior.',
      visualSource: 'remotion-scene',
      visualPrompt: 'Beto, man in his forties with a full beard and blue denim shirt, at a whiteboard.',
      remotionScene: { kind: 'image-kenburns', assetId: 'image-whiteboard-01', zoomFrom: 1, zoomTo: 1.2 },
      estimatedDurationMs: 4400,
      musicTags: ['electronic'],
      sfxTags: ['pop'],
    },
    {
      narration: 'Guardate las tres y no las volvés a pagar.',
      visualSource: 'asset',
      visualPrompt: 'Closing shot of the studio desk, warm light.',
      assetId: 'broll-desk-02',
      estimatedDurationMs: 3000,
      musicTags: ['upbeat'],
      sfxTags: [],
    },
  ],
};

export const storyboardIdentity = {
  id: 'storyboard-monorepo-traps',
  source: 'brief',
  createdAt: '2026-09-09T12:00:00.000Z',
} as const;

export const minimalStoryboardDocument: StoryboardDocument = {
  schemaVersion: 1,
  id: 'storyboard-nx-intro',
  source: 'brief',
  createdAt: '2026-09-09T12:00:00.000Z',
  title: minimalStoryboardProposal.title,
  language: minimalStoryboardProposal.language,
  format: minimalStoryboardProposal.format,
  captionsStyle: minimalStoryboardProposal.captionsStyle,
  musicTags: minimalStoryboardProposal.musicTags,
  characters: [],
  scenes: [
    {
      id: 'scene-01',
      index: 1,
      narration: 'Nx convierte un repo suelto en un monorepo con caché.',
      visualPrompt: 'A developer laptop on a dark desk, neon accent lighting, vertical framing.',
      visualSource: 'upload',
      estimatedDurationMs: 4000,
      musicTags: ['upbeat'],
      sfxTags: [],
    },
  ],
};
