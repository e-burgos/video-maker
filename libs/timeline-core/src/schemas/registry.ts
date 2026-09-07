import { z } from 'zod';

import { AudioMixPlanSchema } from './audio-mix-plan.schema';
import { EditDecisionListSchema } from './edit-decision-list.schema';
import { MediaAssetSchema } from './media-asset.schema';
import { OutputFormatSchema } from './output-format.schema';
import { TimelineSchema } from './timeline.schema';
import { TranscriptionSchema } from './transcription.schema';

export const SCHEMA_FILE_NAMES = [
  'output-format',
  'media-asset',
  'transcription',
  'edit-decision-list',
  'audio-mix-plan',
  'timeline',
] as const;

export type SchemaFileName = (typeof SCHEMA_FILE_NAMES)[number];

export const timelineSchemaRegistry = z.registry<{ id: SchemaFileName }>();

timelineSchemaRegistry.add(OutputFormatSchema, { id: 'output-format' });
timelineSchemaRegistry.add(MediaAssetSchema, { id: 'media-asset' });
timelineSchemaRegistry.add(TranscriptionSchema, { id: 'transcription' });
timelineSchemaRegistry.add(EditDecisionListSchema, { id: 'edit-decision-list' });
timelineSchemaRegistry.add(AudioMixPlanSchema, { id: 'audio-mix-plan' });
timelineSchemaRegistry.add(TimelineSchema, { id: 'timeline' });
