import { StateBadge } from '@e-burgos/tucu-ui';

import type { ServiceHealth } from '../../api/render-api-types';
import type { RequirementsContent } from '../../content/about/about-content';
import { useT } from '../../i18n/language-context';
import { LearnSectionHeading } from '../learn/learn-section-heading';
import { PANEL_CLASS, PANEL_HEADING_CLASS, SECONDARY_BUTTON_SMALL_CLASS, WARNING_TEXT_CLASS } from '../ui/cl-controls';
import { LoadingState } from '../ui/status-states';
import { RequirementRow } from './requirement-row';
import { REQUIREMENT_GROUPS, buildRequirements, countMissing, itemsInGroup } from './requirements-model';

export type RequirementsTabProps = {
  content: RequirementsContent;
  health: ServiceHealth | null;
  loading: boolean;
  onRetry: () => void;
};

export function RequirementsTab({ content, health, loading, onRetry }: RequirementsTabProps) {
  const t = useT();
  const items = health === null ? [] : buildRequirements(health);
  const missing = countMissing(items);
  const producerMissing = itemsInGroup(items, 'producer').every((item) => item.state === 'missing');

  return (
    <div data-testid="about-requirements" className="flex min-w-0 flex-col gap-4">
      <LearnSectionHeading title={content.title} lede={content.lede} />
      {health === null && loading && <LoadingState message={t('about.requirements.loading')} />}
      {health === null && !loading && (
        <div role="alert" data-testid="about-requirements-unavailable" className="flex flex-wrap items-center gap-3">
          <p className={WARNING_TEXT_CLASS}>{t('about.requirements.unavailable')}</p>
          <button type="button" onClick={onRetry} className={SECONDARY_BUTTON_SMALL_CLASS}>
            {t('about.requirements.retry')}
          </button>
        </div>
      )}
      {health !== null && (
        <>
          <div className="px-1" data-testid="about-requirements-summary">
            <StateBadge tone={missing === 0 ? 'green' : 'red'} dot>
              {missing === 0 ? t('about.requirements.summaryOk') : t('about.requirements.summaryMissing', { count: missing })}
            </StateBadge>
          </div>
          {REQUIREMENT_GROUPS.map((group) => (
            <section key={group} data-testid={`about-requirements-${group}`} className={`${PANEL_CLASS} max-w-4xl`}>
              <h3 className={PANEL_HEADING_CLASS}>{content.groups[group]}</h3>
              {group === 'producer' && producerMissing && <p className={WARNING_TEXT_CLASS}>{content.producerNote}</p>}
              <ul
                aria-label={t('about.requirements.list', { group: content.groups[group] })}
                className="m-0 flex list-none flex-col gap-2 p-0"
              >
                {itemsInGroup(items, group).map((item) => (
                  <RequirementRow key={item.id} item={item} copy={content.items[item.id]} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
