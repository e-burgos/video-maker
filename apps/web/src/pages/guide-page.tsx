import { useEffect, useState } from 'react';

import { ProducerMarkdown } from '../components/producer-message-list';
import { loadGuideContent } from '../guide/guide-content';
import type { GuideContent } from '../guide/guide-content';
import { useLanguage, useT } from '../i18n/language-context';

export function GuidePage() {
  const { language } = useLanguage();
  const t = useT();
  const [content, setContent] = useState<GuideContent | null>(null);

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

  if (content === null) {
    return <p className="text-sm text-slate-500">{t('app.loading.guide')}</p>;
  }

  return (
    <section data-testid="guide" data-guide-language={language} className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">{content.intro}</p>
      </div>

      <nav data-testid="guide-index" className="flex flex-wrap gap-2">
        {content.sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            data-guide-link={section.id}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
          >
            {section.title}
          </a>
        ))}
      </nav>

      {content.sections.map((section) => (
        <article
          key={section.id}
          id={section.id}
          data-testid="guide-section"
          data-guide-section={section.id}
          className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-5"
        >
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">{section.title}</h2>
          <ProducerMarkdown text={section.body} />
        </article>
      ))}
    </section>
  );
}
