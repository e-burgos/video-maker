import type { StoryboardDocument, StoryboardScene } from '@video-maker/timeline-core';

function sceneNumber(scene: StoryboardScene): string {
  return String(scene.index).padStart(2, '0');
}

function sceneLabel(scene: StoryboardScene): string {
  switch (scene.visualSource) {
    case 'remotion-scene':
      return `remotion-scene: ${scene.remotionScene?.kind ?? 'unknown'} — no footage needed`;
    case 'asset':
      return `asset: ${scene.assetId ?? 'unknown'} — already in the project`;
    case 'upload':
      return 'upload — generate this one and save it as the numbered file';
  }
}

function charactersSection(document: StoryboardDocument): readonly string[] {
  if (document.characters.length === 0) {
    return [];
  }

  return [
    '## Characters',
    'Paste the description of every character that appears in a shot together with its prompt.',
    ...document.characters.map((character) => `- ${character.name}: ${character.visualDescription}`),
    '',
  ];
}

export function renderStoryboardPrompts(document: StoryboardDocument): string {
  const lines = [
    `# ${document.title}`,
    `Language: ${document.language} · Format: ${document.format} · Scenes: ${document.scenes.length}`,
    '',
    ...charactersSection(document),
    '## Visual prompts',
    'Save each generated file with the number of its scene, for example 01.mp4 or 03.png.',
    '',
    ...document.scenes.flatMap((scene) => [
      `${sceneNumber(scene)}. [${sceneLabel(scene)}]`,
      scene.visualPrompt,
      '',
    ]),
  ];

  return `${lines.join('\n').trimEnd()}\n`;
}
