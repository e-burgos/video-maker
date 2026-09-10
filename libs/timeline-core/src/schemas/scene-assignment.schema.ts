import { z } from 'zod';

import { IdSchema } from './primitives';

export const SCENE_ASSIGNMENT_SCHEMA_VERSION = 1;

export const SceneAssignmentEntrySchema = z.strictObject({
  sceneId: IdSchema,
  assetId: IdSchema.describe('Catalog asset id, which is its project-relative path.'),
});

export const SceneAssignmentSchema = z
  .strictObject({
    schemaVersion: z.literal(SCENE_ASSIGNMENT_SCHEMA_VERSION),
    storyboardId: IdSchema,
    assignments: z.array(SceneAssignmentEntrySchema),
  })
  .superRefine((document, ctx) => {
    const sceneIds = new Set(document.assignments.map((entry) => entry.sceneId));
    if (sceneIds.size !== document.assignments.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignments'],
        message: 'Una escena tiene a lo sumo una asignación de visual.',
      });
    }
  });

export type SceneAssignmentEntry = z.infer<typeof SceneAssignmentEntrySchema>;
export type SceneAssignment = z.infer<typeof SceneAssignmentSchema>;

export function emptySceneAssignment(storyboardId: string): SceneAssignment {
  return {
    schemaVersion: SCENE_ASSIGNMENT_SCHEMA_VERSION,
    storyboardId,
    assignments: [],
  };
}

export function findSceneAssignment(
  document: SceneAssignment,
  sceneId: string,
): SceneAssignmentEntry | undefined {
  return document.assignments.find((entry) => entry.sceneId === sceneId);
}
