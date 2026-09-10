import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';

import {
  fullStoryboardProposal,
  minimalStoryboardDocument,
  minimalStoryboardProposal,
  storyboardIdentity,
} from '../__fixtures__/storyboard';
import type { JsonObject } from './json-schema';
import {
  StoryboardDocumentSchema,
  StoryboardProposalSchema,
  StoryboardSceneProposalSchema,
  storyboardProposalJsonSchema,
  toStoryboardDocument,
} from './storyboard.schema';

type MutableDocument = ReturnType<typeof structuredClone<typeof minimalStoryboardDocument>>;

function documentWithScenes(scenes: MutableDocument['scenes']): unknown {
  return { ...structuredClone(minimalStoryboardDocument), scenes };
}

function sceneWith(overrides: Record<string, unknown>): unknown {
  return { ...structuredClone(minimalStoryboardDocument).scenes[0], ...overrides };
}

describe('StoryboardDocumentSchema', () => {
  it('acepta un documento mínimo', () => {
    expect(StoryboardDocumentSchema.safeParse(minimalStoryboardDocument).success).toBe(true);
  });

  it('acepta un documento completo con las cuatro escenas nativas de Remotion', () => {
    const full = toStoryboardDocument(fullStoryboardProposal, storyboardIdentity);
    const result = StoryboardDocumentSchema.safeParse(full);

    expect(result.success).toBe(true);
    expect(full.scenes.map((scene) => scene.remotionScene?.kind ?? scene.visualSource)).toEqual([
      'upload',
      'code',
      'title',
      'text',
      'image-kenburns',
      'asset',
    ]);
  });

  it('rechaza visualSource=remotion-scene sin remotionScene', () => {
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([sceneWith({ visualSource: 'remotion-scene' })] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'remotionScene']);
  });

  it('rechaza visualSource=upload que trae remotionScene', () => {
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([
        sceneWith({ remotionScene: { kind: 'text', text: 'sobra' } }),
      ] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'remotionScene']);
  });

  it('rechaza visualSource=asset sin assetId', () => {
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([sceneWith({ visualSource: 'asset' })] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'assetId']);
  });

  it('rechaza visualSource=upload que trae assetId', () => {
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([sceneWith({ assetId: 'broll-01' })] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'assetId']);
  });

  it('rechaza una escena Remotion kind=code sin codeLanguage', () => {
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([
        sceneWith({ visualSource: 'remotion-scene', remotionScene: { kind: 'code', code: 'pnpm install' } }),
      ] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'remotionScene', 'codeLanguage']);
  });

  it('rechaza una escena Remotion kind=title que trae props de otro kind', () => {
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([
        sceneWith({
          visualSource: 'remotion-scene',
          remotionScene: { kind: 'title', title: 'Hola', text: 'sobra' },
        }),
      ] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'remotionScene', 'text']);
  });

  it('rechaza una escena Remotion kind=image-kenburns sin zoomTo', () => {
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([
        sceneWith({
          visualSource: 'remotion-scene',
          remotionScene: { kind: 'image-kenburns', zoomFrom: 1 },
        }),
      ] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'remotionScene', 'zoomTo']);
  });

  it('rechaza un index que no es la posición 1-based de la escena', () => {
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([sceneWith({ index: 2 })] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'index']);
  });

  it('rechaza ids de escena repetidos', () => {
    const [scene] = structuredClone(minimalStoryboardDocument).scenes;
    const result = StoryboardDocumentSchema.safeParse(
      documentWithScenes([scene, { ...scene, index: 2 }] as MutableDocument['scenes']),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual(['scenes']);
  });

  it('rechaza ids de personaje repetidos', () => {
    const character = { id: 'character-01', name: 'Ana', visualDescription: 'Short black hair.' };
    const result = StoryboardDocumentSchema.safeParse({
      ...structuredClone(minimalStoryboardDocument),
      characters: [character, { ...character, name: 'Beto' }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual(['characters']);
  });

  it('rechaza un storyboard sin escenas', () => {
    expect(StoryboardDocumentSchema.safeParse(documentWithScenes([])).success).toBe(false);
  });
});

describe('toStoryboardDocument', () => {
  it('asigna ids, index, schemaVersion e identidad, y el resultado valida', () => {
    const document = toStoryboardDocument(fullStoryboardProposal, storyboardIdentity);

    expect(document.schemaVersion).toBe(1);
    expect(document.id).toBe(storyboardIdentity.id);
    expect(document.source).toBe(storyboardIdentity.source);
    expect(document.createdAt).toBe(storyboardIdentity.createdAt);
    expect(document.scenes.map((scene) => scene.id)).toEqual([
      'scene-01',
      'scene-02',
      'scene-03',
      'scene-04',
      'scene-05',
      'scene-06',
    ]);
    expect(document.scenes.map((scene) => scene.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(document.characters.map((character) => character.id)).toEqual(['character-01', 'character-02']);
    expect(StoryboardDocumentSchema.safeParse(document).success).toBe(true);
  });

  it('omite las claves opcionales ausentes en vez de asignarles undefined', () => {
    const document = toStoryboardDocument(minimalStoryboardProposal, storyboardIdentity);

    expect(Object.keys(document.scenes[0]).sort()).toEqual(
      [
        'estimatedDurationMs',
        'id',
        'index',
        'musicTags',
        'narration',
        'sfxTags',
        'visualPrompt',
        'visualSource',
      ].sort(),
    );
  });
});

describe('storyboardProposalJsonSchema', () => {
  const jsonSchema = storyboardProposalJsonSchema();

  it('se deriva del schema Zod: las claves requeridas de una escena son las del shape', () => {
    const sceneShape = StoryboardSceneProposalSchema.shape;
    const zodRequired = Object.entries(sceneShape)
      .filter(([, field]) => !field.safeParse(undefined).success)
      .map(([key]) => key)
      .sort();
    const scenes = (jsonSchema.properties as JsonObject).scenes as JsonObject;
    const derivedRequired = [...((scenes.items as JsonObject).required as string[])].sort();

    expect(derivedRequired).toEqual(zodRequired);
  });

  it('no declara $schema ni $id: un agente CLI ignora en silencio el schema que los trae', () => {
    expect(jsonSchema).not.toHaveProperty('$schema');
    expect(jsonSchema).not.toHaveProperty('$id');
  });

  it('cierra los objetos y conserva las descripciones que guían al modelo', () => {
    const scenes = (jsonSchema.properties as JsonObject).scenes as JsonObject;
    const sceneItems = scenes.items as JsonObject;

    expect(jsonSchema.additionalProperties).toBe(false);
    expect(sceneItems.additionalProperties).toBe(false);
    expect(((sceneItems.properties as JsonObject).visualSource as JsonObject).description).toContain(
      'remotion-scene',
    );
  });

  it('valida las propuestas de ejemplo contra el JSON Schema derivado', () => {
    const validate = new Ajv2020({ strict: false }).compile(jsonSchema);

    expect(validate(minimalStoryboardProposal)).toBe(true);
    expect(validate(fullStoryboardProposal)).toBe(true);
  });

  it('rechaza contra el JSON Schema derivado una propuesta a la que le falta un campo', () => {
    const validate = new Ajv2020({ strict: false }).compile(jsonSchema);
    const { scenes, ...withoutScenes } = minimalStoryboardProposal;

    expect(scenes.length).toBe(1);
    expect(validate(withoutScenes)).toBe(false);
  });
});

describe('StoryboardProposalSchema', () => {
  it('acepta las propuestas de ejemplo', () => {
    expect(StoryboardProposalSchema.safeParse(minimalStoryboardProposal).success).toBe(true);
    expect(StoryboardProposalSchema.safeParse(fullStoryboardProposal).success).toBe(true);
  });

  it('rechaza una propuesta con una escena incoherente', () => {
    const broken = structuredClone(minimalStoryboardProposal);
    const result = StoryboardProposalSchema.safeParse({
      ...broken,
      scenes: [{ ...broken.scenes[0], visualSource: 'asset' }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['scenes', 0, 'assetId']);
  });
});
