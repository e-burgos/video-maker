import type { StoryboardDocument, StoryboardScene } from '@video-maker/timeline-core';

import { storyboardIssues } from '../../api/storyboard-edit/storyboard-document';

export type SceneStatus = 'ready' | 'edited' | 'incomplete';

export type SceneTiming = { startMs: number; endMs: number };

export function sceneTimings(scenes: readonly StoryboardScene[]): Map<string, SceneTiming> {
  const timings = new Map<string, SceneTiming>();
  let cursor = 0;
  scenes.forEach((scene) => {
    const endMs = cursor + scene.estimatedDurationMs;
    timings.set(scene.id, { startMs: cursor, endMs });
    cursor = endMs;
  });
  return timings;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function formatSceneSeconds(ms: number): string {
  return String(Math.round(ms / 1000));
}

function indexesWithIssues(storyboard: StoryboardDocument): Set<number> {
  const indexes = new Set<number>();
  storyboardIssues(storyboard).forEach((issue) => {
    const match = /^scenes\.(\d+)(?:\.|$)/.exec(issue.path);
    if (match !== null) {
      indexes.add(Number(match[1]));
    }
  });
  return indexes;
}

export function sceneStatuses(
  storyboard: StoryboardDocument,
  baseline: StoryboardDocument | null,
): Map<string, SceneStatus> {
  const incomplete = indexesWithIssues(storyboard);
  const stored = new Map((baseline?.scenes ?? []).map((scene) => [scene.id, JSON.stringify(scene)]));
  const statuses = new Map<string, SceneStatus>();
  storyboard.scenes.forEach((scene, position) => {
    if (incomplete.has(position)) {
      statuses.set(scene.id, 'incomplete');
    } else if (baseline !== null && stored.get(scene.id) !== JSON.stringify(scene)) {
      statuses.set(scene.id, 'edited');
    } else {
      statuses.set(scene.id, 'ready');
    }
  });
  return statuses;
}
