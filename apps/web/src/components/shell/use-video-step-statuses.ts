import { useCallback, useEffect, useRef } from 'react';

import { projectModeOf } from '../../api/project-mode';
import { useRenderApi } from '../../api/render-api-context';
import { ASSET_ROLES } from '../../api/render-api-types';
import type { AssetRole, ProjectDetail } from '../../api/render-api-types';
import { useAsyncResource } from '../../hooks/use-async-resource';
import type { StepStatus } from './shell-navigation';

export type VideoStepStatuses = Readonly<Record<string, StepStatus>>;

export type VideoStepFacts = {
  project: ProjectDetail;
  hasStoryboard: boolean;
  hasVoice: boolean;
};

const NO_STATUSES: VideoStepStatuses = {};

function primaryRoleOf(project: ProjectDetail): AssetRole {
  return projectModeOf(project) === 'motion' ? 'image' : 'aroll';
}

function materialStatus(project: ProjectDetail): StepStatus {
  const total = ASSET_ROLES.reduce((sum, role) => sum + (project.assetCounts[role] ?? 0), 0);
  if (total === 0) return 'pending';
  return (project.assetCounts[primaryRoleOf(project)] ?? 0) > 0 ? 'ok' : 'warn';
}

function previewStatus(project: ProjectDetail): StepStatus {
  if (project.layout.out) return 'ok';
  return project.layout.timeline ? 'warn' : 'pending';
}

export function deriveVideoStepStatuses({ project, hasStoryboard, hasVoice }: VideoStepFacts): VideoStepStatuses {
  return {
    '/library': materialStatus(project),
    '/storyboard': hasStoryboard ? 'ok' : 'pending',
    '/voice': hasVoice ? 'ok' : 'pending',
    '/preview': previewStatus(project),
  };
}

function swallow(): false {
  return false;
}

export function useVideoStepStatuses(slug: string | null, refreshKey = ''): VideoStepStatuses {
  const client = useRenderApi();
  const resource = useAsyncResource<VideoStepFacts | null>(
    useCallback(async () => {
      if (slug === null) return null;
      const [project, hasStoryboard, hasVoice] = await Promise.all([
        client.getProject(slug),
        client.getStoryboard(slug).then(() => true, swallow),
        client.getVoice(slug).then(() => true, swallow),
      ]);
      return { project, hasStoryboard, hasVoice };
    }, [client, slug]),
    `video-step-statuses:${slug ?? ''}`,
  );
  const { reload } = resource;
  const lastRefreshKey = useRef(refreshKey);

  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) return;
    lastRefreshKey.current = refreshKey;
    if (slug !== null) reload();
  }, [refreshKey, slug, reload]);

  return resource.data === null ? NO_STATUSES : deriveVideoStepStatuses(resource.data);
}
