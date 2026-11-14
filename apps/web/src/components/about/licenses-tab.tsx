import type { LicensesContent } from '../../content/about/about-content';
import { TECH_CATEGORIES, TECH_INVENTORY } from '../../content/about/tech-inventory';
import { useLanguage, useT } from '../../i18n/language-context';
import { LearnSectionHeading } from '../learn/learn-section-heading';
import { PANEL_CLASS, PANEL_HEADING_CLASS } from '../ui/cl-controls';
import { InlinePartsView } from './inline-parts-view';
import { TechItemCard } from './tech-item-card';

export type LicensesTabProps = {
  content: LicensesContent;
};

export function LicensesTab({ content }: LicensesTabProps) {
  const t = useT();
  const { language } = useLanguage();

  return (
    <div data-testid="about-licenses" className="flex min-w-0 flex-col gap-4">
      <LearnSectionHeading title={content.title} lede={content.lede} />
      <section className={`${PANEL_CLASS} max-w-4xl`}>
        <h3 className={PANEL_HEADING_CLASS}>{content.ownCodeTitle}</h3>
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">
          <InlinePartsView parts={content.ownCode} />
        </p>
        <h3 className={PANEL_HEADING_CLASS}>{content.remotionTitle}</h3>
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">
          <InlinePartsView parts={content.remotion} />
        </p>
        <h3 className={PANEL_HEADING_CLASS}>{content.noticesTitle}</h3>
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">
          <InlinePartsView parts={content.notices} />
        </p>
      </section>
      <LearnSectionHeading title={content.inventoryTitle} lede={content.inventoryLede} />
      {TECH_CATEGORIES.map((category) => {
        const items = TECH_INVENTORY.filter((item) => item.category === category.id);
        return (
          <section key={category.id} data-testid="about-tech-category" data-category-id={category.id} className={PANEL_CLASS}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className={PANEL_HEADING_CLASS}>{category.title[language]}</h3>
              <span className="font-data text-[11px] text-[var(--cl-ink-3)]">
                {t('about.licenses.count', { count: items.length })}
              </span>
            </div>
            <p className="m-0 text-xs text-[var(--cl-ink-2)]">{category.lede[language]}</p>
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <TechItemCard key={item.id} item={item} language={language} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
