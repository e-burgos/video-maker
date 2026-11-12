import { buildJsonSchemaBundle } from '@video-maker/timeline-core';
import { BrandManifestSchema, MotionBriefSchema, MotionStoryboardSchema } from '@video-maker/motion-graphics';
import { z } from 'zod';

import type { JsonSchemaNode } from './field-rows';
import { inlineExternalRefs } from './inline-external-refs';

export type ReferenceSource = {
  id: string;
  title: string;
  sourcePath: string;
  schemaFile: string;
  jsonSchema: () => JsonSchemaNode;
  flatSchema: () => JsonSchemaNode;
};

const zodToJsonSchema = (schema: z.ZodType): JsonSchemaNode =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'draft-2020-12' }) as JsonSchemaNode;

export const REFERENCE_SOURCES: ReferenceSource[] = [
  {
    id: 'timeline',
    title: 'Timeline',
    sourcePath: 'libs/timeline-core/src/schemas',
    schemaFile: 'timeline.schema.json',
    jsonSchema: () => buildJsonSchemaBundle().timeline as JsonSchemaNode,
    flatSchema: () => inlineExternalRefs(buildJsonSchemaBundle().timeline as JsonSchemaNode, buildJsonSchemaBundle() as Record<string, JsonSchemaNode>),
  },
  {
    id: 'motion-storyboard',
    title: 'Motion storyboard',
    sourcePath: 'libs/motion-graphics/src/storyboard/motion-storyboard.schema.ts',
    schemaFile: 'motion-storyboard.schema.json',
    jsonSchema: () => zodToJsonSchema(MotionStoryboardSchema),
    flatSchema: () => zodToJsonSchema(MotionStoryboardSchema),
  },
  {
    id: 'motion-brief',
    title: 'Motion brief',
    sourcePath: 'libs/motion-graphics/src/auto/motion-brief.ts',
    schemaFile: 'motion-brief.schema.json',
    jsonSchema: () => zodToJsonSchema(MotionBriefSchema),
    flatSchema: () => zodToJsonSchema(MotionBriefSchema),
  },
  {
    id: 'brand',
    title: 'Brand manifest (brand.json)',
    sourcePath: 'libs/motion-graphics/src/brand/brand-manifest.ts',
    schemaFile: 'brand.schema.json',
    jsonSchema: () => zodToJsonSchema(BrandManifestSchema),
    flatSchema: () => zodToJsonSchema(BrandManifestSchema),
  },
];
