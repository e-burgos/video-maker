import type {
  RemotionScene,
  RemotionSceneKind,
  StoryboardDocument,
  StoryboardFormat,
  StoryboardScene,
  VisualSource,
} from '@video-maker/timeline-core';
import { StoryboardDocumentSchema } from '@video-maker/timeline-core';

export const STORYBOARD_FORMATS: readonly StoryboardFormat[] = ['9:16', '16:9', '1:1'];

export const VISUAL_SOURCES: readonly VisualSource[] = ['upload', 'asset', 'remotion-scene'];

export const REMOTION_SCENE_KINDS: readonly RemotionSceneKind[] = [
  'title',
  'text',
  'code',
  'image-kenburns',
];

export type StoryboardHeaderField = 'title' | 'language' | 'format' | 'captionsStyle';

export type StoryboardSceneTextField = 'narration' | 'visualPrompt' | 'assetId' | 'captionsStyle';

export type RemotionSceneTextField = 'title' | 'subtitle' | 'text' | 'code' | 'codeLanguage';

export type StoryboardIssue = {
  path: string;
  message: string;
};

const DEFAULT_REMOTION_SCENE_BY_KIND: Readonly<Record<RemotionSceneKind, RemotionScene>> = {
  title: { kind: 'title', title: 'Title' },
  text: { kind: 'text', text: 'Body copy' },
  code: { kind: 'code', code: 'echo hello', codeLanguage: 'bash' },
  'image-kenburns': { kind: 'image-kenburns', zoomFrom: 1, zoomTo: 1.2 },
};

function omitKeys<T extends object>(source: T, keys: readonly string[]): T {
  const rest = { ...source } as Record<string, unknown>;
  keys.forEach((key) => delete rest[key]);
  return rest as T;
}

export function storyboardIssues(document: StoryboardDocument): StoryboardIssue[] {
  const parsed = StoryboardDocumentSchema.safeParse(document);

  if (parsed.success) {
    return [];
  }

  return parsed.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function canSaveStoryboard(document: StoryboardDocument): boolean {
  return storyboardIssues(document).length === 0;
}

export function setStoryboardHeader(
  document: StoryboardDocument,
  field: StoryboardHeaderField,
  value: string,
): StoryboardDocument {
  return { ...document, [field]: value };
}

export function setStoryboardMusicTags(
  document: StoryboardDocument,
  tags: string,
): StoryboardDocument {
  return { ...document, musicTags: parseTags(tags) };
}

export function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function formatTags(tags: readonly string[]): string {
  return tags.join(', ');
}

export function setCharacterField(
  document: StoryboardDocument,
  characterId: string,
  field: 'name' | 'visualDescription',
  value: string,
): StoryboardDocument {
  return {
    ...document,
    characters: document.characters.map((character) =>
      character.id === characterId ? { ...character, [field]: value } : character,
    ),
  };
}

function mapScene(
  document: StoryboardDocument,
  sceneId: string,
  transform: (scene: StoryboardScene) => StoryboardScene,
): StoryboardDocument {
  return {
    ...document,
    scenes: document.scenes.map((scene) => (scene.id === sceneId ? transform(scene) : scene)),
  };
}

export function setSceneText(
  document: StoryboardDocument,
  sceneId: string,
  field: StoryboardSceneTextField,
  value: string,
): StoryboardDocument {
  return mapScene(document, sceneId, (scene) => {
    if ((field === 'assetId' || field === 'captionsStyle') && value.length === 0) {
      return omitKeys(scene, [field]);
    }
    return { ...scene, [field]: value };
  });
}

export function setSceneDuration(
  document: StoryboardDocument,
  sceneId: string,
  estimatedDurationMs: number,
): StoryboardDocument {
  return mapScene(document, sceneId, (scene) => ({ ...scene, estimatedDurationMs }));
}

export function setSceneTags(
  document: StoryboardDocument,
  sceneId: string,
  field: 'musicTags' | 'sfxTags',
  value: string,
): StoryboardDocument {
  return mapScene(document, sceneId, (scene) => ({ ...scene, [field]: parseTags(value) }));
}

export function setSceneVisualSource(
  document: StoryboardDocument,
  sceneId: string,
  visualSource: VisualSource,
): StoryboardDocument {
  return mapScene(document, sceneId, (scene) => {
    const rest = omitKeys(scene, ['assetId', 'remotionScene']);
    if (visualSource === 'asset') {
      return { ...rest, visualSource, assetId: scene.assetId ?? '' };
    }
    if (visualSource === 'remotion-scene') {
      return {
        ...rest,
        visualSource,
        remotionScene: scene.remotionScene ?? DEFAULT_REMOTION_SCENE_BY_KIND.title,
      };
    }
    return { ...rest, visualSource };
  });
}

export function setRemotionSceneKind(
  document: StoryboardDocument,
  sceneId: string,
  kind: RemotionSceneKind,
): StoryboardDocument {
  return mapScene(document, sceneId, (scene) =>
    scene.remotionScene === undefined
      ? scene
      : { ...scene, remotionScene: DEFAULT_REMOTION_SCENE_BY_KIND[kind] },
  );
}

export function setRemotionSceneText(
  document: StoryboardDocument,
  sceneId: string,
  field: RemotionSceneTextField,
  value: string,
): StoryboardDocument {
  return mapScene(document, sceneId, (scene) => {
    if (scene.remotionScene === undefined) {
      return scene;
    }
    if (field === 'subtitle' && value.length === 0) {
      return { ...scene, remotionScene: omitKeys(scene.remotionScene, ['subtitle']) };
    }
    return { ...scene, remotionScene: { ...scene.remotionScene, [field]: value } };
  });
}

export function setRemotionSceneZoom(
  document: StoryboardDocument,
  sceneId: string,
  field: 'zoomFrom' | 'zoomTo',
  value: number,
): StoryboardDocument {
  return mapScene(document, sceneId, (scene) =>
    scene.remotionScene === undefined
      ? scene
      : { ...scene, remotionScene: { ...scene.remotionScene, [field]: value } },
  );
}
