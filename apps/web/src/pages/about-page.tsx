import { useTabParam } from '@e-burgos/tucu-ui';
import { useCallback } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { AboutTabBar } from '../components/about/about-tab-bar';
import { AboutTabPanel } from '../components/about/about-tab-panel';
import { ABOUT_TABS } from '../components/about/about-tabs';
import { LicensesTab } from '../components/about/licenses-tab';
import { ProseTab } from '../components/about/prose-tab';
import { RequirementsTab } from '../components/about/requirements-tab';
import { useAboutContent } from '../components/about/use-about-content';
import { useUpdateCheck } from '../components/about/use-update-check';
import { VersionTab } from '../components/about/version-tab';
import { useToolbarAction } from '../components/shell/use-toolbar-action';
import { LoadingState } from '../components/ui/status-states';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import type { AboutContent } from '../content/about/about-content';
import type { AboutTab } from '../components/about/about-tabs';
import type { ServiceHealth } from '../api/render-api-types';

type TabBodyProps = {
  tab: Exclude<AboutTab, 'version'>;
  content: AboutContent;
  health: ServiceHealth | null;
  healthLoading: boolean;
  reloadHealth: () => void;
};

function TabBody({ tab, content, health, healthLoading, reloadHealth }: TabBodyProps) {
  switch (tab) {
    case 'requirements':
      return <RequirementsTab content={content.requirements} health={health} loading={healthLoading} onRetry={reloadHealth} />;
    case 'licenses':
      return <LicensesTab content={content.licenses} />;
    case 'open-source':
      return <ProseTab testId="about-open-source" content={content.openSource} />;
    case 'privacy':
      return <ProseTab testId="about-privacy" content={content.privacy} />;
  }
}

export function AboutPage() {
  const t = useT();
  const client = useRenderApi();
  const [tab, setTab] = useTabParam({ values: ABOUT_TABS });
  const content = useAboutContent();
  const update = useUpdateCheck();

  const loadHealth = useCallback(() => client.getHealth(), [client]);
  const health = useAsyncResource<ServiceHealth>(loadHealth, 'about-health');

  useToolbarAction({
    label: t('about.update.action'),
    loading: update.phase === 'checking',
    onClick: () => {
      setTab('version');
      void update.check();
    },
  });

  const installedVersion = update.result?.installedVersion || health.data?.version || null;

  return (
    <section data-testid="about-page" className="flex min-w-0 flex-col gap-3">
      <AboutTabBar active={tab} onSelect={setTab} />
      <AboutTabPanel key={tab} tab={tab}>
        {tab === 'version' && (
          <VersionTab
            installedVersion={installedVersion}
            loading={health.status === 'loading'}
            phase={update.phase}
            result={update.result}
          />
        )}
        {tab !== 'version' && content === null && <LoadingState message={t('app.loading.about')} />}
        {tab !== 'version' && content !== null && (
          <TabBody
            tab={tab}
            content={content}
            health={health.data}
            healthLoading={health.status === 'loading'}
            reloadHealth={health.reload}
          />
        )}
      </AboutTabPanel>
    </section>
  );
}
