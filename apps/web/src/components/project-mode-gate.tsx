import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { projectModeOf } from '../api/project-mode';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { LoadingState } from './ui/status-states';

export type ProjectModeGateProps = {
  slug: string;
  footage: ReactNode;
  motion: ReactNode;
};

export function ProjectModeGate({ slug, footage, motion }: ProjectModeGateProps) {
  const t = useT();
  const client = useRenderApi();
  const project = useAsyncResource(
    useCallback(() => client.getProject(slug), [client, slug]),
    `mode-gate:${slug}`,
  );

  if (project.status === 'loading') {
    return <LoadingState message={t('projectMode.loading')} />;
  }

  return project.data !== null && projectModeOf(project.data) === 'motion' ? motion : footage;
}
