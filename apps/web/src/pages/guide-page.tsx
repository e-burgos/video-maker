import { useEffect, useMemo, useState } from 'react';

import { GuideIndex } from '../components/guide/guide-index';
import { GuideSectionCard } from '../components/guide/guide-section-card';
import { useActiveGuideSection } from '../components/guide/use-active-guide-section';
import { loadGuideContent } from '../guide/guide-content';
import type { GuideContent } from '../guide/guide-content';
import { useLanguage, useT } from '../i18n/language-context';

const NO_SECTION_IDS: readonly string[] = [];

export function GuidePage() {
  const { language } = useLanguage();
  const t = useT();
  const [content, setContent] = useState<GuideContent | null>(null);
  const sectionIds = useMemo(() => content?.sections.map((section) => section.id) ?? NO_SECTION_IDS, [content]);
  const [activeId, setActiveId] = useActiveGuideSection(sectionIds);

  useEffect(() => {
    let subscribed = true;
    void loadGuideContent(language).then((loaded) => {
      if (subscribed) {
        setContent(loaded);
      }
    });
    return () => {
      subscribed = false;
    };
  }, [language]);

  useEffect(() => {
    if (content !== null && window.location.hash !== '') {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView?.();
    }
  }, [content]);

  if (content === null) {
    return <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('app.loading.guide')}</p>;
  }

  return (
    <section data-testid="guide" data-guide-language={language} className="flex flex-col gap-4">
      <div className="px-1">
        <h1 className="m-0 text-2xl font-bold tracking-tight text-[var(--cl-ink)]">{content.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--cl-ink-2)]">{content.intro}</p>
      </div>

      <div className="grid items-start gap-3 min-[1100px]:grid-cols-[15rem_minmax(0,1fr)]">
        <GuideIndex sections={content.sections} activeId={activeId} onSelect={setActiveId} />
        <div className="flex min-w-0 flex-col gap-3">
          {content.sections.map((section, index) => (
            <GuideSectionCard key={section.id} section={section} position={index + 1} total={content.sections.length} />
          ))}
        </div>
      </div>
    </section>
  );
}
