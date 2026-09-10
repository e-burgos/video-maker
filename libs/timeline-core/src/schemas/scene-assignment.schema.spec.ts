import { describe, expect, it } from 'vitest';

import {
  SCENE_ASSIGNMENT_SCHEMA_VERSION,
  SceneAssignmentSchema,
  emptySceneAssignment,
  findSceneAssignment,
} from './scene-assignment.schema';

describe('SceneAssignmentSchema', () => {
  it('accepts one asset per scene', () => {
    const parsed = SceneAssignmentSchema.parse({
      schemaVersion: SCENE_ASSIGNMENT_SCHEMA_VERSION,
      storyboardId: 'storyboard-01',
      assignments: [
        { sceneId: 'scene-01', assetId: 'raw/images/01.png' },
        { sceneId: 'scene-02', assetId: 'raw/broll/02.mp4' },
      ],
    });

    expect(parsed.assignments).toHaveLength(2);
  });

  it('rejects two assignments for the same scene', () => {
    const result = SceneAssignmentSchema.safeParse({
      schemaVersion: SCENE_ASSIGNMENT_SCHEMA_VERSION,
      storyboardId: 'storyboard-01',
      assignments: [
        { sceneId: 'scene-01', assetId: 'raw/images/01.png' },
        { sceneId: 'scene-01', assetId: 'raw/images/02.png' },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('a lo sumo una asignación');
  });

  it('rejects an unknown key', () => {
    const result = SceneAssignmentSchema.safeParse({
      schemaVersion: SCENE_ASSIGNMENT_SCHEMA_VERSION,
      storyboardId: 'storyboard-01',
      assignments: [{ sceneId: 'scene-01', assetId: 'raw/images/01.png', role: 'image' }],
    });

    expect(result.success).toBe(false);
  });
});

describe('emptySceneAssignment', () => {
  it('starts with no assignment for the given storyboard', () => {
    expect(emptySceneAssignment('storyboard-07')).toEqual({
      schemaVersion: SCENE_ASSIGNMENT_SCHEMA_VERSION,
      storyboardId: 'storyboard-07',
      assignments: [],
    });
  });
});

describe('findSceneAssignment', () => {
  const document = SceneAssignmentSchema.parse({
    schemaVersion: SCENE_ASSIGNMENT_SCHEMA_VERSION,
    storyboardId: 'storyboard-01',
    assignments: [{ sceneId: 'scene-02', assetId: 'raw/broll/02.mp4' }],
  });

  it('returns the entry of the requested scene', () => {
    expect(findSceneAssignment(document, 'scene-02')?.assetId).toBe('raw/broll/02.mp4');
  });

  it('returns undefined for a scene without an assignment', () => {
    expect(findSceneAssignment(document, 'scene-01')).toBeUndefined();
  });
});
