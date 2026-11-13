import type { StateBadgeTone } from '@e-burgos/tucu-ui';

import type { ProjectLayout } from './render-api-types';

export type ProjectStatusKey =
  | 'projects.status.noMaterial'
  | 'projects.status.materialLoaded'
  | 'projects.status.montageReady'
  | 'projects.status.videoReady';

export function projectStatusKey(layout: ProjectLayout): ProjectStatusKey {
  if (layout.out) {
    return 'projects.status.videoReady';
  }
  if (layout.timeline) {
    return 'projects.status.montageReady';
  }
  if (layout.raw) {
    return 'projects.status.materialLoaded';
  }
  return 'projects.status.noMaterial';
}

export const PROJECT_STATUS_TONE: Readonly<Record<ProjectStatusKey, StateBadgeTone>> = {
  'projects.status.noMaterial': 'orange',
  'projects.status.materialLoaded': 'neutral',
  'projects.status.montageReady': 'purple',
  'projects.status.videoReady': 'teal',
};
