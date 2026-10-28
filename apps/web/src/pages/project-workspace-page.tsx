import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { projectModeOf } from '../api/project-mode';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { humanizeSlug, projectDisplayName } from '../api/humanize-slug';
import { ProducerConversationPanel } from '../components/producer-conversation-panel';
import { ProposalStatusBadge } from '../components/proposal-status-badge';
import { Button } from '../components/ui/button';
import { WorkspaceSidePanel } from '../components/workspace-side-panel';
import { useAutoSwitchingTab } from '../hooks/use-auto-switching-tab';
import { useIsWideViewport } from '../hooks/use-is-wide-viewport';
import { useProducerConversation } from '../hooks/use-producer-conversation';
import { useT } from '../i18n/language-context';

export function ProjectWorkspacePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const t = useT();
  const client = useRenderApi();
  const project = useAsyncResource(
    useCallback(async () => client.getProject(slug), [client, slug]),
    `workspace-project:${slug}`,
  );
  const producer = useProducerConversation(slug);
  const isWide = useIsWideViewport();
  const [activeTab, setActiveTab] = useAutoSwitchingTab(producer.jobs.data);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMotion = project.data !== null && projectModeOf(project.data) === 'motion';

  const sidePanel = (
    <WorkspaceSidePanel
      slug={slug}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      assets={producer.assets}
      jobs={producer.jobs}
      generated={producer.generated.data}
    />
  );

  return (
    <section
      data-testid="project-workspace"
      className={isWide ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-6'}
    >
      <header className="shrink-0 space-y-3">
        <Link to="/" className="text-xs text-ink-faint hover:text-ink-muted">
          {t('library.backToProjects')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{project.data === null ? humanizeSlug(slug) : projectDisplayName(project.data)}</h1>
            <p className="font-mono text-xs text-ink-faint">{slug}</p>
          </div>
          <ProposalStatusBadge proposal={producer.proposal.data?.proposal ?? null} />
        </div>
      </header>

      {isMotion ? (
        <div className={isWide ? 'min-h-0 flex-1' : ''}>
          <ProducerConversationPanel producer={producer} pinned={isWide} mode="motion" />
        </div>
      ) : isWide ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
          <ProducerConversationPanel producer={producer} pinned />
          <div className="h-full min-h-0 overflow-y-auto">{sidePanel}</div>
        </div>
      ) : (
        <div className="space-y-4">
          <ProducerConversationPanel producer={producer} />
          <Button
            variant="secondary"
            aria-expanded={drawerOpen}
            data-testid="workspace-panel-toggle"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            {drawerOpen ? t('workspace.panel.hide') : t('workspace.panel.show')}
          </Button>
          {drawerOpen && sidePanel}
        </div>
      )}
    </section>
  );
}
