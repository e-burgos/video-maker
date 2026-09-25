import { z } from 'zod';

import type { JsonObject } from './json-schema';
import { IdSchema, MsSchema } from './primitives';

export const STORYBOARD_SCHEMA_VERSION = 1;

export const StoryboardFormatSchema = z.enum(['9:16', '16:9', '1:1']);
export const StoryboardSourceSchema = z.enum(['brief', 'script']);
export const VisualSourceSchema = z.enum(['upload', 'asset', 'remotion-scene']);
export const RemotionSceneKindSchema = z.enum(['title', 'text', 'code', 'image-kenburns']);

export const RemotionSceneSchema = z.strictObject({
  kind: RemotionSceneKindSchema.describe(
    'Which native Remotion scene renders this beat when no generated footage is used.',
  ),
  title: z.string().min(1).optional().describe('Required for kind=title. Headline shown on screen.'),
  subtitle: z.string().min(1).optional().describe('Optional second line, only for kind=title.'),
  text: z.string().min(1).optional().describe('Required for kind=text. Body copy shown on screen.'),
  code: z.string().min(1).optional().describe('Required for kind=code. Source snippet shown on screen.'),
  codeLanguage: z
    .string()
    .min(1)
    .optional()
    .describe('Required for kind=code. Language name used for highlighting, lowercase.'),
  assetId: IdSchema.optional().describe('Optional catalog asset id for kind=image-kenburns.'),
  zoomFrom: z
    .number()
    .min(1)
    .max(3)
    .optional()
    .describe('Required for kind=image-kenburns. Starting zoom factor, 1 means no zoom.'),
  zoomTo: z
    .number()
    .min(1)
    .max(3)
    .optional()
    .describe('Required for kind=image-kenburns. Ending zoom factor, 1 means no zoom.'),
});

const RemotionSceneTitleForModelSchema = z.strictObject({
  kind: z.literal('title'),
  title: z.string().min(1).describe('Headline shown on screen.'),
  subtitle: z.string().min(1).nullable().describe('An optional second line; null when unused.'),
});

const RemotionSceneTextForModelSchema = z.strictObject({
  kind: z.literal('text'),
  text: z.string().min(1).describe('Body copy shown on screen.'),
});

const RemotionSceneCodeForModelSchema = z.strictObject({
  kind: z.literal('code'),
  code: z.string().min(1).describe('Source snippet shown on screen.'),
  codeLanguage: z.string().min(1).describe('Language name used for highlighting, lowercase.'),
});

const RemotionSceneImageKenburnsForModelSchema = z.strictObject({
  kind: z.literal('image-kenburns'),
  assetId: IdSchema.nullable().describe('An optional catalog asset id; null when unused.'),
  zoomFrom: z.number().min(1).max(3).describe('Starting zoom factor, 1 means no zoom.'),
  zoomTo: z.number().min(1).max(3).describe('Ending zoom factor, 1 means no zoom.'),
});

const RemotionSceneForModelSchema = z.discriminatedUnion('kind', [
  RemotionSceneTitleForModelSchema,
  RemotionSceneTextForModelSchema,
  RemotionSceneCodeForModelSchema,
  RemotionSceneImageKenburnsForModelSchema,
]);

const CHARACTER_FIELDS = {
  name: z.string().min(1).describe('Short name used to refer to the character across scenes.'),
  visualDescription: z
    .string()
    .min(1)
    .describe(
      'Self-contained physical description repeated in every visual prompt so the character stays consistent across separately generated shots.',
    ),
};

export const StoryboardCharacterProposalSchema = z.strictObject(CHARACTER_FIELDS);

export const StoryboardCharacterSchema = z.strictObject({
  id: IdSchema,
  ...CHARACTER_FIELDS,
});

const SCENE_FIELDS = {
  narration: z.string().min(1).describe('Spoken voice-over text for this scene, in the storyboard language.'),
  visualPrompt: z
    .string()
    .min(1)
    .describe(
      'Prompt the user pastes into an external image or video generator. Self-contained: it repeats the description of every character it shows.',
    ),
  visualSource: VisualSourceSchema.describe(
    'upload: the user brings generated footage. asset: an existing catalog asset is reused. remotion-scene: no footage is needed and remotionScene must be filled.',
  ),
  assetId: IdSchema.optional().describe('Required when visualSource is asset. Id of the catalog asset to reuse.'),
  remotionScene: RemotionSceneSchema.optional().describe('Required when visualSource is remotion-scene.'),
  estimatedDurationMs: MsSchema.describe(
    'Rough duration of the scene in milliseconds. The real duration is later taken from the voice track.',
  ),
  captionsStyle: z.string().min(1).optional().describe('Overrides the storyboard caption style for this scene only.'),
  musicTags: z.array(z.string().min(1)).describe('Mood tags used to pick a music bed, lowercase english words.'),
  sfxTags: z.array(z.string().min(1)).describe('Sound effect tags for this scene, lowercase english words.'),
};

export const StoryboardSceneProposalSchema = z.strictObject(SCENE_FIELDS);

const SCENE_FIELDS_FOR_MODEL_SCHEMA = {
  ...SCENE_FIELDS,
  assetId: IdSchema.nullable().describe(
    'The id of the catalog asset to reuse when visualSource is asset; null for every other visualSource. Always include this field, never omit it.',
  ),
  remotionScene: RemotionSceneForModelSchema.nullable().describe(
    'A RemotionScene object when visualSource is remotion-scene; null for every other visualSource. Always include this field, never omit it. Its shape depends on kind: only the fields that kind allows, never any other field.',
  ),
};

const StoryboardSceneProposalForModelSchema = z.strictObject(SCENE_FIELDS_FOR_MODEL_SCHEMA);

export const StoryboardSceneSchema = z.strictObject({
  id: IdSchema,
  index: z.number().int().min(1),
  ...SCENE_FIELDS,
});

const STORYBOARD_FIELDS = {
  title: z.string().min(1).describe('Title of the video.'),
  language: z
    .string()
    .min(2)
    .describe('BCP-47 language tag the narration is written in, for example es-AR or en-US.'),
  format: StoryboardFormatSchema.describe('Aspect ratio of the deliverable.'),
  captionsStyle: z.string().min(1).describe('Caption style applied to every scene that does not override it.'),
  musicTags: z.array(z.string().min(1)).describe('Mood tags for the music bed of the whole video.'),
};

const StoryboardProposalObjectSchema = z.strictObject({
  ...STORYBOARD_FIELDS,
  characters: z.array(StoryboardCharacterProposalSchema).describe('Every recurring character shown in the video.'),
  scenes: z.array(StoryboardSceneProposalSchema).min(1).describe('Scenes in playback order.'),
});

const StoryboardProposalForModelSchema = z.strictObject({
  ...STORYBOARD_FIELDS,
  characters: z.array(StoryboardCharacterProposalSchema).describe('Every recurring character shown in the video.'),
  scenes: z.array(StoryboardSceneProposalForModelSchema).min(1).describe('Scenes in playback order.'),
});

function addIssue(ctx: z.RefinementCtx, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: 'custom', path, message });
}

const REQUIRED_REMOTION_PROPS: Readonly<Record<z.infer<typeof RemotionSceneKindSchema>, readonly string[]>> = {
  title: ['title'],
  text: ['text'],
  code: ['code', 'codeLanguage'],
  'image-kenburns': ['zoomFrom', 'zoomTo'],
};

const ALLOWED_REMOTION_PROPS: Readonly<Record<z.infer<typeof RemotionSceneKindSchema>, readonly string[]>> = {
  title: ['title', 'subtitle'],
  text: ['text'],
  code: ['code', 'codeLanguage'],
  'image-kenburns': ['zoomFrom', 'zoomTo', 'assetId'],
};

function refineRemotionScene(
  scene: z.infer<typeof RemotionSceneSchema>,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  for (const prop of REQUIRED_REMOTION_PROPS[scene.kind]) {
    if (scene[prop as keyof typeof scene] === undefined) {
      addIssue(ctx, [...path, prop], `Una escena Remotion kind=${scene.kind} requiere ${prop}.`);
    }
  }

  const allowed = ALLOWED_REMOTION_PROPS[scene.kind];
  for (const [prop, value] of Object.entries(scene)) {
    if (prop !== 'kind' && value !== undefined && !allowed.includes(prop)) {
      addIssue(ctx, [...path, prop], `Una escena Remotion kind=${scene.kind} no declara ${prop}.`);
    }
  }
}

interface RefinableScene {
  readonly visualSource: z.infer<typeof VisualSourceSchema>;
  readonly assetId?: string | undefined;
  readonly remotionScene?: z.infer<typeof RemotionSceneSchema> | undefined;
}

function refineScene(scene: RefinableScene, ctx: z.RefinementCtx, path: (string | number)[]): void {
  if (scene.visualSource === 'asset' && scene.assetId === undefined) {
    addIssue(ctx, [...path, 'assetId'], 'Una escena visualSource=asset requiere assetId.');
  }
  if (scene.visualSource !== 'asset' && scene.assetId !== undefined) {
    addIssue(ctx, [...path, 'assetId'], `Una escena visualSource=${scene.visualSource} no declara assetId.`);
  }
  if (scene.visualSource === 'remotion-scene' && scene.remotionScene === undefined) {
    addIssue(ctx, [...path, 'remotionScene'], 'Una escena visualSource=remotion-scene requiere remotionScene.');
  }
  if (scene.visualSource !== 'remotion-scene' && scene.remotionScene !== undefined) {
    addIssue(
      ctx,
      [...path, 'remotionScene'],
      `Una escena visualSource=${scene.visualSource} no declara remotionScene.`,
    );
  }
  if (scene.remotionScene !== undefined) {
    refineRemotionScene(scene.remotionScene, ctx, [...path, 'remotionScene']);
  }
}

export const StoryboardProposalSchema = StoryboardProposalObjectSchema.superRefine((proposal, ctx) => {
  proposal.scenes.forEach((scene, position) => refineScene(scene, ctx, ['scenes', position]));
});

export const StoryboardDocumentSchema = z
  .strictObject({
    schemaVersion: z.literal(STORYBOARD_SCHEMA_VERSION),
    id: IdSchema,
    source: StoryboardSourceSchema,
    createdAt: z.iso.datetime(),
    ...STORYBOARD_FIELDS,
    characters: z.array(StoryboardCharacterSchema),
    scenes: z.array(StoryboardSceneSchema).min(1),
  })
  .superRefine((document, ctx) => {
    document.scenes.forEach((scene, position) => {
      refineScene(scene, ctx, ['scenes', position]);
      if (scene.index !== position + 1) {
        addIssue(ctx, ['scenes', position, 'index'], 'El index de una escena es su posición 1-based en scenes.');
      }
    });

    const sceneIds = new Set(document.scenes.map((scene) => scene.id));
    if (sceneIds.size !== document.scenes.length) {
      addIssue(ctx, ['scenes'], 'Los ids de escena son únicos dentro del storyboard.');
    }

    const characterIds = new Set(document.characters.map((character) => character.id));
    if (characterIds.size !== document.characters.length) {
      addIssue(ctx, ['characters'], 'Los ids de personaje son únicos dentro del storyboard.');
    }
  });

export type StoryboardFormat = z.infer<typeof StoryboardFormatSchema>;
export type StoryboardSource = z.infer<typeof StoryboardSourceSchema>;
export type VisualSource = z.infer<typeof VisualSourceSchema>;
export type RemotionSceneKind = z.infer<typeof RemotionSceneKindSchema>;
export type RemotionScene = z.infer<typeof RemotionSceneSchema>;
export type StoryboardCharacter = z.infer<typeof StoryboardCharacterSchema>;
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;
export type StoryboardDocument = z.infer<typeof StoryboardDocumentSchema>;
export type StoryboardProposal = z.infer<typeof StoryboardProposalSchema>;

const JSON_SCHEMA_IDENTITY_KEYS = ['$schema', '$id'] as const;

export function storyboardProposalJsonSchema(): JsonObject {
  const schema = z.toJSONSchema(StoryboardProposalForModelSchema, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'throw',
  }) as JsonObject;

  return Object.fromEntries(
    Object.entries(schema).filter(
      ([key]) => !(JSON_SCHEMA_IDENTITY_KEYS as readonly string[]).includes(key),
    ),
  ) as JsonObject;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withoutNullValues(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null));
}

function normalizeScene(scene: unknown): unknown {
  if (!isRecord(scene)) {
    return scene;
  }
  const withoutNullScene = withoutNullValues(scene);
  if (!isRecord(withoutNullScene.remotionScene)) {
    return withoutNullScene;
  }
  return { ...withoutNullScene, remotionScene: withoutNullValues(withoutNullScene.remotionScene) };
}

export function normalizeStoryboardProposalInput(raw: unknown): unknown {
  if (!isRecord(raw) || !Array.isArray(raw.scenes)) {
    return raw;
  }
  return { ...raw, scenes: raw.scenes.map(normalizeScene) };
}

export interface StoryboardIdentity {
  readonly id: string;
  readonly source: StoryboardSource;
  readonly createdAt: string;
}

function paddedIndex(position: number): string {
  return String(position + 1).padStart(2, '0');
}

export function toStoryboardDocument(
  proposal: StoryboardProposal,
  identity: StoryboardIdentity,
): StoryboardDocument {
  return {
    schemaVersion: STORYBOARD_SCHEMA_VERSION,
    id: identity.id,
    source: identity.source,
    createdAt: identity.createdAt,
    title: proposal.title,
    language: proposal.language,
    format: proposal.format,
    captionsStyle: proposal.captionsStyle,
    musicTags: proposal.musicTags,
    characters: proposal.characters.map((character, position) => ({
      id: `character-${paddedIndex(position)}`,
      name: character.name,
      visualDescription: character.visualDescription,
    })),
    scenes: proposal.scenes.map((scene, position) => ({
      id: `scene-${paddedIndex(position)}`,
      index: position + 1,
      narration: scene.narration,
      visualPrompt: scene.visualPrompt,
      visualSource: scene.visualSource,
      ...(scene.assetId === undefined ? {} : { assetId: scene.assetId }),
      ...(scene.remotionScene === undefined ? {} : { remotionScene: scene.remotionScene }),
      estimatedDurationMs: scene.estimatedDurationMs,
      ...(scene.captionsStyle === undefined ? {} : { captionsStyle: scene.captionsStyle }),
      musicTags: scene.musicTags,
      sfxTags: scene.sfxTags,
    })),
  };
}
