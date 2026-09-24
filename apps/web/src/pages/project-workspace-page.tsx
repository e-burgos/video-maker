import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ProducerConversationPanel } from '../components/producer-conversation-panel';
import { ServiceHealthBadge } from '../components/service-health-badge';
import { Button } from '../components/ui/button';
import { WorkspaceSidePanel } from '../components/workspace-side-panel';
import { useAutoSwitchingTab } from '../hooks/use-auto-switching-tab';
import { useIsWideViewport } from '../hooks/use-is-wide-viewport';
import { useProducerConversation } from '../hooks/use-producer-conversation';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';

const ADVANCED_LINKS = [
  { path: 'library', labelKey: 'workspace.menu.library' },
  { path: 'storyboard', labelKey: 'workspace.menu.storyboard' },
  { path: 'voice', labelKey: 'workspace.menu.voice' },
  { path: 'preview', labelKey: 'workspace.menu.preview' },
] as const satisfies readonly { path: string; labelKey: TranslationKey }[];

function AdvancedEditingMenu({ slug }: { slug: string }) {
  const t = useT();

  return (
    <details className="relative" data-testid="workspace-advanced-menu">
      <summary className="cursor-pointer list-none rounded-control border border-border-strong px-3 py-1.5 text-xs text-ink-muted hover:border-ink-faint hover:text-ink">
        {t('workspace.advancedMenu')}
      </summary>
      <nav className="absolute right-0 z-10 mt-2 w-52 space-y-1 rounded-panel border border-border-subtle bg-surface p-2 shadow-lg">
        {ADVANCED_LINKS.map((link) => (
          <Link
            key={link.path}
            to={`/projects/${encodeURIComponent(slug)}/${link.path}`}
            className="block rounded-control px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>
    </details>
  );
}

export function ProjectWorkspacePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const t = useT();
  const producer = useProducerConversation(slug);
  const isWide = useIsWideViewport();
  const [activeTab, setActiveTab] = useAutoSwitchingTab(producer.jobs.data);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sidePanel = (
    <WorkspaceSidePanel
      slug={slug}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      assets={producer.assets}
      jobs={producer.jobs}
    />
  );

  return (
    <section data-testid="project-workspace" className="space-y-6">
      <header className="space-y-3">
        <Link to="/" className="text-xs text-ink-faint hover:text-ink-muted">
          {t('library.backToProjects')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-ink">{slug}</h1>
          <div className="flex items-center gap-3">
            <ServiceHealthBadge />
            <AdvancedEditingMenu slug={slug} />
          </div>
        </div>
      </header>

      {isWide ? (
        <div className="grid grid-cols-[3fr_2fr] items-start gap-6">
          <ProducerConversationPanel producer={producer} />
          {sidePanel}
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
