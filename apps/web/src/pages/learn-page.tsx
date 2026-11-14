import { useTabParam } from '@e-burgos/tucu-ui';

import { FaqTab } from '../components/learn/faq-tab';
import { GalleryTab } from '../components/learn/gallery-tab';
import { HowItWorksTab } from '../components/learn/how-it-works-tab';
import { LearnTabBar } from '../components/learn/learn-tab-bar';
import { LearnTabPanel } from '../components/learn/learn-tab-panel';
import { LEARN_TABS } from '../components/learn/learn-tabs';
import { TutorialTab } from '../components/learn/tutorial-tab';
import { useLearnContent } from '../components/learn/use-learn-content';
import { LoadingState } from '../components/ui/status-states';
import { useT } from '../i18n/language-context';
import type { LearnContent } from '../content/learn/learn-content';
import type { LearnTab } from '../components/learn/learn-tabs';
import { GuidePage } from './guide-page';

function TabBody({ tab, content }: { tab: Exclude<LearnTab, 'guide'>; content: LearnContent }) {
  switch (tab) {
    case 'how-it-works':
      return <HowItWorksTab content={content.howItWorks} />;
    case 'tutorial':
      return <TutorialTab content={content.tutorial} />;
    case 'faq':
      return <FaqTab content={content.faq} />;
    case 'gallery':
      return <GalleryTab content={content.gallery} />;
  }
}

export function LearnPage() {
  const t = useT();
  const [tab, setTab] = useTabParam({ values: LEARN_TABS });
  const content = useLearnContent();

  return (
    <section data-testid="learn-page" className="flex min-w-0 flex-col gap-3">
      <LearnTabBar active={tab} onSelect={setTab} />
      <LearnTabPanel key={tab} tab={tab}>
        {tab === 'guide' && <GuidePage />}
        {tab !== 'guide' && content === null && <LoadingState message={t('app.loading.learn')} />}
        {tab !== 'guide' && content !== null && <TabBody tab={tab} content={content} />}
      </LearnTabPanel>
    </section>
  );
}
