import { ASSET_ROLES, BRAND_FILE_KINDS } from '@video-maker/studio-capabilities/constants';
import { z } from 'zod';

import type { StudioToolName } from '../contract/tool-names';
import { ProjectModeSchema } from '../contract/tool-schemas';

export const EXTERNAL_ONLY_TOOL_NAMES = [
  'studio_status',
  'get_capabilities',
  'list_projects',
  'create_project',
  'upload_asset',
  'list_brands',
  'get_brand',
  'create_brand',
  'update_brand',
  'upload_brand_file',
] as const;

export type ExternalOnlyToolName = (typeof EXTERNAL_ONLY_TOOL_NAMES)[number];

export const EXTERNAL_EXCLUDED_TOOL_NAMES: readonly StudioToolName[] = ['queue_publication', 'draft_publication'];

export const NON_PROJECT_SCOPED_TOOL_NAMES: readonly StudioToolName[] = ['list_voices', 'get_motion_brands'];

export const EXTERNAL_ASSET_ROLES = ASSET_ROLES;
export const EXTERNAL_BRAND_FILE_KINDS = BRAND_FILE_KINDS;

export const ProjectSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u, 'slug must be kebab-case: lowercase letters and digits separated by single hyphens')
  .describe('The video project this call applies to (the slug from list_projects or create_project)');

const BrandIdSchema = z.string().min(1).describe('The brand id');
const LocalFilePathSchema = z.string().min(1).describe('Absolute path of a file on this machine (for example in the repository you are working in)');
const FileNameSchema = z.string().min(1).regex(/^[^/\\]+$/u, 'a plain file name without folders').optional();

const AnyObject = z.looseObject({});

export interface ExternalToolDefinition {
  readonly description: string;
  readonly input: z.ZodObject;
  readonly output: z.ZodTypeAny;
}

export const EXTERNAL_ONLY_TOOLS: Readonly<Record<ExternalOnlyToolName, ExternalToolDefinition>> = {
  studio_status: {
    description:
      'Say which Video Maker studio this session is connected to (apiUrl, where it was found: desktop app, dev studio or environment), its version and whether its engine, binaries and producer are healthy. Call it first; if it fails, ask the user to open the Video Maker app.',
    input: z.strictObject({}),
    output: z.looseObject({ apiUrl: z.string(), source: z.string(), version: z.string(), status: z.string() }),
  },
  get_capabilities: {
    description:
      'List what the studio engine can do today: output formats, project modes, montage presets and transitions, motion scene kinds, exits and title styles, bumper backgrounds and reveals, text overlay kinds and variants, the sound effects bank, voices, job kinds and asset roles. Read it before writing a brief or storyboard instead of assuming.',
    input: z.strictObject({}),
    output: AnyObject,
  },
  list_projects: {
    description: 'List the video projects of the studio (slug, mode, brand, title, layout flags and last publication).',
    input: z.strictObject({}),
    output: z.looseObject({ projects: z.array(z.unknown()) }),
  },
  create_project: {
    description:
      'Create a new video project. `slug` is kebab-case and unique; `mode` is footage (montage of recordings, default) or motion (animated video made from a brief and storyboard); `brand` is a brand id from list_brands. Fails when the slug exists.',
    input: z.strictObject({
      slug: ProjectSlugSchema,
      mode: ProjectModeSchema.optional(),
      brand: z.string().min(1).optional().describe('Brand id to apply to the project'),
      title: z.string().min(1).max(120).optional(),
    }),
    output: AnyObject,
  },
  upload_asset: {
    description:
      'Upload a local file into a project as raw material: it lands in raw/<role>/<filename> and is cataloged. `role` is aroll (main footage or screen recording), broll, image, audio (music), voice (narration), logo or reference. Fails when that filename already exists in the project.',
    input: z.strictObject({
      slug: ProjectSlugSchema,
      role: z.enum(EXTERNAL_ASSET_ROLES),
      filePath: LocalFilePathSchema,
      filename: FileNameSchema.describe('Name to store it under; defaults to the local file name'),
    }),
    output: AnyObject,
  },
  list_brands: {
    description: 'List the brands the studio has (built-in and user-made).',
    input: z.strictObject({}),
    output: AnyObject,
  },
  get_brand: {
    description: 'Read one brand: its manifest (colors, fonts, tone, music) and the files it carries.',
    input: z.strictObject({ id: BrandIdSchema }),
    output: AnyObject,
  },
  create_brand: {
    description:
      'Create a user brand from a name (optionally with an id, or duplicating another brand with duplicateFrom). Then fill it in with update_brand and upload_brand_file.',
    input: z.strictObject({
      name: z.string().min(1),
      id: z.string().min(1).optional(),
      duplicateFrom: z.string().min(1).optional().describe('Id of an existing brand to start from'),
    }),
    output: AnyObject,
  },
  update_brand: {
    description:
      'Replace the manifest of a user brand. Send the whole manifest as read with get_brand (same `id`); files it references must already be uploaded with upload_brand_file. Built-in brands cannot be changed.',
    input: z.strictObject({ id: BrandIdSchema, manifest: z.record(z.string(), z.unknown()).describe('The complete brand manifest') }),
    output: AnyObject,
  },
  upload_brand_file: {
    description:
      'Upload a local file into a user brand: kind is logo, image, font, music or device. The studio validates the extension for the kind.',
    input: z.strictObject({
      id: BrandIdSchema,
      kind: z.enum(EXTERNAL_BRAND_FILE_KINDS),
      filePath: LocalFilePathSchema,
      name: FileNameSchema.describe('Name to store it under; defaults to the local file name'),
    }),
    output: AnyObject,
  },
};
