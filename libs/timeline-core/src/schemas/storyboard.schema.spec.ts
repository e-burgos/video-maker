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
  RemotionSceneSchema,
  StoryboardDocumentSchema,
  StoryboardProposalSchema,
  StoryboardSceneProposalSchema,
  normalizeStoryboardProposalInput,
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

const REMOTION_SCENE_BRANCH_FIELDS: Readonly<Record<string, { required: readonly string[]; nullableOptional: readonly string[] }>> = {
  title: { required: ['title'], nullableOptional: ['subtitle'] },
  text: { required: ['text'], nullableOptional: [] },
  code: { required: ['code', 'codeLanguage'], nullableOptional: [] },
  'image-kenburns': { required: ['zoomFrom', 'zoomTo'], nullableOptional: ['assetId'] },
};

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRawModelRemotionScene(remotionScene: Record<string, unknown>): unknown {
  const branch = REMOTION_SCENE_BRANCH_FIELDS[remotionScene.kind as string];
  const result: Record<string, unknown> = { kind: remotionScene.kind };
  for (const field of branch.required) {
    result[field] = remotionScene[field];
  }
  for (const field of branch.nullableOptional) {
    result[field] = remotionScene[field] ?? null;
  }
  return result;
}

function asRawModelScene(scene: Record<string, unknown>): unknown {
  const withDefaults: Record<string, unknown> = { assetId: null, remotionScene: null, ...scene };
  if (isRecordLike(withDefaults.remotionScene)) {
    withDefaults.remotionScene = asRawModelRemotionScene(withDefaults.remotionScene);
  }
  return withDefaults;
}

function asRawModelProposal(proposal: typeof minimalStoryboardProposal): unknown {
  return {
    ...proposal,
    scenes: proposal.scenes.map((scene) => asRawModelScene(scene as unknown as Record<string, unknown>)),
  };
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

  const DELIBERATELY_MODEL_ONLY_REQUIRED_KEYS = ['remotionScene', 'assetId'];

  it('se deriva del schema Zod: las claves requeridas de una escena son las del shape, salvo remotionScene y assetId', () => {
    const sceneShape = StoryboardSceneProposalSchema.shape;
    const zodRequired = Object.entries(sceneShape)
      .filter(([key, field]) => !DELIBERATELY_MODEL_ONLY_REQUIRED_KEYS.includes(key) && !field.safeParse(undefined).success)
      .map(([key]) => key)
      .sort();
    const scenes = (jsonSchema.properties as JsonObject).scenes as JsonObject;
    const derivedRequired = [...((scenes.items as JsonObject).required as string[])]
      .filter((key) => !DELIBERATELY_MODEL_ONLY_REQUIRED_KEYS.includes(key))
      .sort();

    expect(derivedRequired).toEqual(zodRequired);
  });

  it('vuelve remotionScene obligatorio y nullable para el modelo, aunque en el contrato guardado siga siendo opcional', () => {
    const scenes = (jsonSchema.properties as JsonObject).scenes as JsonObject;
    const sceneItems = scenes.items as JsonObject;
    const remotionSceneField = (sceneItems.properties as JsonObject).remotionScene as JsonObject;

    expect((sceneItems.required as string[])).toContain('remotionScene');
    expect(remotionSceneField.anyOf).toBeDefined();
    expect((remotionSceneField.anyOf as JsonObject[]).some((entry) => entry.type === 'null')).toBe(true);
    expect(StoryboardSceneProposalSchema.shape.remotionScene.safeParse(undefined).success).toBe(true);
  });

  it('vuelve assetId obligatorio y nullable para el modelo, aunque en el contrato guardado siga siendo opcional', () => {
    const scenes = (jsonSchema.properties as JsonObject).scenes as JsonObject;
    const sceneItems = scenes.items as JsonObject;
    const assetIdField = (sceneItems.properties as JsonObject).assetId as JsonObject;

    expect((sceneItems.required as string[])).toContain('assetId');
    expect((assetIdField.anyOf as JsonObject[]).some((entry) => entry.type === 'null')).toBe(true);
    expect(StoryboardSceneProposalSchema.shape.assetId.safeParse(undefined).success).toBe(true);
  });

  it('estructura remotionScene como un oneOf por kind: cada rama cierra sus propiedades a las que ese kind permite', () => {
    const scenes = (jsonSchema.properties as JsonObject).scenes as JsonObject;
    const sceneItems = scenes.items as JsonObject;
    const remotionSceneField = (sceneItems.properties as JsonObject).remotionScene as JsonObject;
    const unionEntry = (remotionSceneField.anyOf as JsonObject[]).find((entry) => entry.oneOf !== undefined);
    const branches = unionEntry?.oneOf as JsonObject[];

    expect(branches).toHaveLength(4);
    for (const branch of branches) {
      expect(branch.additionalProperties).toBe(false);
    }

    const branchFor = (kind: string): JsonObject =>
      branches.find((branch) => ((branch.properties as JsonObject).kind as JsonObject).const === kind) as JsonObject;

    const titleBranch = branchFor('title');
    expect(titleBranch.required).toEqual(['kind', 'title', 'subtitle']);
    expect(titleBranch.properties).not.toHaveProperty('text');
    expect(titleBranch.properties).not.toHaveProperty('code');
    expect(titleBranch.properties).not.toHaveProperty('zoomFrom');

    const codeBranch = branchFor('code');
    expect(codeBranch.required).toEqual(['kind', 'code', 'codeLanguage']);
    expect(codeBranch.properties).not.toHaveProperty('title');

    const kenburnsBranch = branchFor('image-kenburns');
    expect(kenburnsBranch.required).toEqual(['kind', 'assetId', 'zoomFrom', 'zoomTo']);
    expect(kenburnsBranch.properties).not.toHaveProperty('title');

    expect(RemotionSceneSchema.shape.title.safeParse(undefined).success).toBe(true);
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

  it('valida las propuestas de ejemplo, en forma de salida cruda del modelo, contra el JSON Schema derivado', () => {
    const validate = new Ajv2020({ strict: false }).compile(jsonSchema);

    expect(validate(asRawModelProposal(minimalStoryboardProposal))).toBe(true);
    expect(validate(asRawModelProposal(fullStoryboardProposal))).toBe(true);
  });

  it('rechaza contra el JSON Schema derivado una propuesta a la que le falta un campo', () => {
    const validate = new Ajv2020({ strict: false }).compile(jsonSchema);
    const { scenes, ...withoutScenes } = minimalStoryboardProposal;

    expect(scenes.length).toBe(1);
    expect(validate(withoutScenes)).toBe(false);
  });
});

describe('normalizeStoryboardProposalInput', () => {
  it('quita remotionScene cuando vale null, para volver al contrato guardado (opcional, no nullable)', () => {
    const raw = asRawModelProposal(minimalStoryboardProposal);
    const normalized = normalizeStoryboardProposalInput(raw) as { scenes: Record<string, unknown>[] };

    expect(normalized.scenes[0]).not.toHaveProperty('remotionScene');
    expect(StoryboardProposalSchema.safeParse(normalized).success).toBe(true);
  });

  it('conserva un remotionScene real, no solo lo quita porque está presente', () => {
    const raw = asRawModelProposal(fullStoryboardProposal);
    const normalized = normalizeStoryboardProposalInput(raw) as { scenes: Record<string, unknown>[] };

    expect(normalized.scenes[1]?.remotionScene).toEqual({ kind: 'code', code: 'pnpm install\nnpm install', codeLanguage: 'bash' });
    expect(StoryboardProposalSchema.safeParse(normalized).success).toBe(true);
  });

  it('un remotionScene null junto a visualSource=remotion-scene sigue siendo una propuesta inválida, no la esconde', () => {
    const rawScene = {
      ...minimalStoryboardProposal.scenes[0],
      visualSource: 'remotion-scene',
      remotionScene: null,
    };
    const raw = { ...minimalStoryboardProposal, scenes: [rawScene] };
    const normalized = normalizeStoryboardProposalInput(raw);

    const result = StoryboardProposalSchema.safeParse(normalized);
    expect(result.success).toBe(false);
  });

  it('no toca una entrada que no tiene forma de propuesta de storyboard', () => {
    expect(normalizeStoryboardProposalInput('not an object')).toBe('not an object');
    expect(normalizeStoryboardProposalInput(null)).toBe(null);
    expect(normalizeStoryboardProposalInput({ foo: 'bar' })).toEqual({ foo: 'bar' });
  });

  it('quita, dentro de remotionScene, los campos que el modelo mandó en null porque no aplican al kind elegido', () => {
    const rawScene = {
      ...minimalStoryboardProposal.scenes[0],
      visualSource: 'remotion-scene',
      remotionScene: {
        kind: 'title',
        title: 'Hola',
        subtitle: null,
        text: null,
        code: null,
        codeLanguage: null,
        assetId: null,
        zoomFrom: null,
        zoomTo: null,
      },
    };
    const raw = { ...minimalStoryboardProposal, scenes: [rawScene] };
    const normalized = normalizeStoryboardProposalInput(raw) as { scenes: Record<string, unknown>[] };

    expect(normalized.scenes[0]?.remotionScene).toEqual({ kind: 'title', title: 'Hola' });
    expect(StoryboardProposalSchema.safeParse(normalized).success).toBe(true);
  });

  it('un campo null que sí hace falta para el kind elegido sigue siendo una propuesta inválida', () => {
    const rawScene = {
      ...minimalStoryboardProposal.scenes[0],
      visualSource: 'remotion-scene',
      remotionScene: {
        kind: 'title',
        title: null,
        subtitle: null,
        text: null,
        code: null,
        codeLanguage: null,
        assetId: null,
        zoomFrom: null,
        zoomTo: null,
      },
    };
    const raw = { ...minimalStoryboardProposal, scenes: [rawScene] };
    const normalized = normalizeStoryboardProposalInput(raw);

    const result = StoryboardProposalSchema.safeParse(normalized);
    expect(result.success).toBe(false);
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
