import { useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { projectModeOf } from '../api/project-mode';
import { projectDisplayName } from '../api/humanize-slug';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { Scene } from '../theme/scene';
import { ProjectBrandControl } from './project-brand-control';
import { ShellContent } from './shell/shell-content';
import { projectSlugFromPathname, toolbarHeadingFor } from './shell/shell-navigation';
import { ShellSidebar } from './shell/shell-sidebar';
import { ShellToolbar } from './shell/shell-toolbar';
import { ToolbarActionProvider } from './shell/toolbar-action-provider';
import { useVideoStepStatuses } from './shell/use-video-step-statuses';
import { VideoStepsRail } from './shell/video-steps-rail';
import { VideoStepsNav } from './shell/video-steps-nav';

export { projectSlugFromPathname };

export function StudioLayout() {
  const { pathname } = useLocation();
  const slug = projectSlugFromPathname(pathname);
  const t = useT();
  const client = useRenderApi();
  const project = useAsyncResource(
    useCallback(async () => (slug === null ? null : client.getProject(slug)), [client, slug]),
    `layout-project:${slug ?? ''}`,
  );
  const stepStatuses = useVideoStepStatuses(slug, pathname);
  const heading = toolbarHeadingFor(pathname);
  const videoTitle = slug === null ? null : project.data === null ? projectDisplayName({ slug }) : projectDisplayName(project.data);
  const subtitle = heading.subtitleKey === null ? videoTitle : t(heading.subtitleKey);

  const videoBlock =
    slug === null || videoTitle === null ? null : (
      <VideoStepsNav
        slug={slug}
        title={videoTitle}
        isMotion={project.data !== null && projectModeOf(project.data) === 'motion'}
        statusByPath={stepStatuses}
        footer={
          project.data === null ? undefined : (
            <ProjectBrandControl slug={slug} project={project.data} onChanged={project.reload} />
          )
        }
      />
    );

  const videoRail =
    slug === null || videoTitle === null ? null : (
      <VideoStepsRail
        slug={slug}
        title={videoTitle}
        isMotion={project.data !== null && projectModeOf(project.data) === 'motion'}
        statusByPath={stepStatuses}
      />
    );

  return (
    <ToolbarActionProvider>
      <Scene>
        <div className="flex h-dvh text-[var(--cl-ink)]">
          <ShellSidebar videoBlock={videoBlock} videoRail={videoRail} />
          <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
            <ShellToolbar title={t(heading.titleKey)} subtitle={subtitle} />
            <ShellContent>
              <Outlet />
            </ShellContent>
          </div>
        </div>
      </Scene>
    </ToolbarActionProvider>
  );
}
