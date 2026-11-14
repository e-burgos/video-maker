import { SegmentedControl, StateBadge } from '@e-burgos/tucu-ui';
import { useCallback, useMemo, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import {
  FIELD_SMALL_CLASS,
  HINT_TEXT_CLASS,
  LINK_CLASS,
  SECONDARY_BUTTON_SMALL_CLASS,
  WARNING_TEXT_CLASS,
} from './ui/cl-controls';
import type { OpenRouterCatalogModel, OpenRouterModelSort, OpenRouterModelTier } from '../api/render-api-types';
import type { TranslateFn } from '../i18n/language-context';

const PAGE_SIZE = 30;
const OPENROUTER_PRIVACY_URL = 'https://openrouter.ai/settings/privacy';

type OpenRouterModelView = 'recommended' | 'all';
type OpenRouterModelSortChoice = 'default' | OpenRouterModelSort;

export type OpenRouterModelPickerProps = {
  value: string;
  onChange: (id: string) => void;
  recommendedIds: ReadonlySet<string>;
};

function tierLabelKey(tier: OpenRouterModelTier): 'settings.openrouterModels.tier.free' | 'settings.openrouterModels.tier.cheap' | 'settings.openrouterModels.tier.reference' {
  return `settings.openrouterModels.tier.${tier}` as const;
}

function priceText(t: TranslateFn, model: OpenRouterCatalogModel): string {
  if (model.isFree) {
    return t('settings.openrouterModels.price.free');
  }
  return t('settings.openrouterModels.price.perMillion', {
    prompt: model.pricing.promptPerMTokUsd.toFixed(2),
    completion: model.pricing.completionPerMTokUsd.toFixed(2),
  });
}

function ModelCard({
  model,
  selected,
  onSelect,
  t,
}: {
  model: OpenRouterCatalogModel;
  selected: boolean;
  onSelect: () => void;
  t: TranslateFn;
}) {
  return (
    <li
      data-testid="openrouter-model-card"
      className={`glass-sub flex flex-col gap-1 rounded-[12px] p-3 ${selected ? 'border-[var(--cl-action-ring)]' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--cl-ink)]">{model.name}</span>
        {model.recommendation !== null && (
          <StateBadge tone="neutral" size="sm">
            {t(tierLabelKey(model.recommendation.tier))}
          </StateBadge>
        )}
      </div>
      <p className="font-data m-0 break-all text-[11px] text-[var(--cl-ink-3)]">{model.id}</p>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">{priceText(t, model)}</p>
      <p className={HINT_TEXT_CLASS}>
        {t(model.supportsImages ? 'settings.openrouterModels.images.yes' : 'settings.openrouterModels.images.no')}
        {' · '}
        {t('settings.openrouterModels.context', { tokens: model.contextLength.toLocaleString('en-US') })}
      </p>
      {model.recommendation !== null && model.recommendation.bench !== null && (
        <p data-testid="openrouter-model-bench" className={`${HINT_TEXT_CLASS} font-data text-[11px]`}>
          {t('settings.openrouterModels.bench', {
            successRate: Math.round(model.recommendation.bench.successRate * 100),
            avgSteps: model.recommendation.bench.avgSteps,
            avgSeconds: Math.round(model.recommendation.bench.avgSeconds),
            avgCostUsd: model.recommendation.bench.avgCostUsd.toFixed(3),
          })}
        </p>
      )}
      <button
        type="button"
        onClick={onSelect}
        disabled={selected}
        className={`${SECONDARY_BUTTON_SMALL_CLASS} mt-1 self-start`}
      >
        {t(selected ? 'settings.openrouterModels.selected' : 'settings.openrouterModels.select')}
      </button>
    </li>
  );
}

function ModelRow({
  model,
  selected,
  onSelect,
  t,
}: {
  model: OpenRouterCatalogModel;
  selected: boolean;
  onSelect: () => void;
  t: TranslateFn;
}) {
  return (
    <li
      data-testid="openrouter-model-row"
      className={`glass-sub flex flex-wrap items-center justify-between gap-2 rounded-[12px] px-3 py-2 ${selected ? 'border-[var(--cl-action-ring)]' : ''}`}
    >
      <div className="min-w-0">
        <p className="m-0 truncate text-sm font-semibold text-[var(--cl-ink)]">{model.name}</p>
        <p className="font-data m-0 truncate text-[11px] text-[var(--cl-ink-3)]">{model.id}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--cl-ink-2)]">
        {model.isFree && (
          <StateBadge tone="green" size="sm">
            {t('settings.openrouterModels.price.free')}
          </StateBadge>
        )}
        <span>{priceText(t, model)}</span>
        <span>{t('settings.openrouterModels.context', { tokens: model.contextLength.toLocaleString('en-US') })}</span>
        <button
          type="button"
          onClick={onSelect}
          disabled={selected}
          className={SECONDARY_BUTTON_SMALL_CLASS}
        >
          {t(selected ? 'settings.openrouterModels.selected' : 'settings.openrouterModels.select')}
        </button>
      </div>
    </li>
  );
}

export function OpenRouterModelPicker({ value, onChange, recommendedIds }: OpenRouterModelPickerProps) {
  const client = useRenderApi();
  const t = useT();

  const [view, setView] = useState<OpenRouterModelView>('recommended');
  const [query, setQuery] = useState('');
  const [sortChoice, setSortChoice] = useState<OpenRouterModelSortChoice>('default');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sort = sortChoice === 'default' ? undefined : sortChoice;

  const load = useCallback(
    () => client.getOpenRouterModels(view === 'recommended' ? { scope: 'recommended' } : { scope: 'all', q: query, sort }),
    [client, view, query, sort],
  );
  const key = `openrouter-models:${view}:${String(sort)}:${query}`;
  const resource = useAsyncResource(load, key);

  const models = resource.data?.models ?? [];
  const visibleModels = useMemo(() => models.slice(0, visibleCount), [models, visibleCount]);
  const hasMore = models.length > visibleModels.length;

  const selectedIsRecommended = value === '' || recommendedIds.has(value);

  function changeView(nextView: OpenRouterModelView) {
    setView(nextView);
    setVisibleCount(PAGE_SIZE);
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    setVisibleCount(PAGE_SIZE);
  }

  function changeSort(nextSort: OpenRouterModelSortChoice) {
    setSortChoice(nextSort);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div data-testid="openrouter-model-picker" className="flex flex-col gap-3">
      <div className="glass-thin max-w-full self-start overflow-x-auto rounded-[10px] p-[3px]">
        <SegmentedControl
          size="xs"
          aria-label={t('settings.openrouterModels.viewLabel')}
          options={[
            {
              value: 'recommended',
              label: t('settings.openrouterModels.tab.recommended'),
              'data-testid': 'openrouter-models-tab-recommended',
            },
            { value: 'all', label: t('settings.openrouterModels.tab.all'), 'data-testid': 'openrouter-models-tab-all' },
          ]}
          value={view}
          onChange={(next) => changeView(next as OpenRouterModelView)}
        />
      </div>

      {view === 'all' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={t('settings.openrouterModels.searchPlaceholder')}
            aria-label={t('settings.openrouterModels.searchPlaceholder')}
            className={`${FIELD_SMALL_CLASS} w-56 max-w-full`}
          />
          <label htmlFor="openrouter-models-sort" className="text-xs text-[var(--cl-ink-2)]">
            {t('settings.openrouterModels.sortLabel')}
          </label>
          <select
            id="openrouter-models-sort"
            value={sortChoice}
            onChange={(event) => changeSort(event.target.value as OpenRouterModelSortChoice)}
            className={FIELD_SMALL_CLASS}
          >
            <option value="default">{t('settings.openrouterModels.sort.default')}</option>
            <option value="price">{t('settings.openrouterModels.sort.price')}</option>
            <option value="name">{t('settings.openrouterModels.sort.name')}</option>
          </select>
        </div>
      )}

      {resource.status === 'loading' && (
        <p className={HINT_TEXT_CLASS}>{t('settings.openrouterModels.loading')}</p>
      )}

      {resource.status === 'error' && resource.error !== null && (
        <ErrorNotice error={resource.error} onRetry={resource.reload} surface="glass" />
      )}

      {resource.data !== null && resource.data.stale && (
        <p className={WARNING_TEXT_CLASS}>{t('settings.openrouterModels.stale')}</p>
      )}

      {resource.data !== null && models.length === 0 && (
        <p className={HINT_TEXT_CLASS}>{t('settings.openrouterModels.empty')}</p>
      )}

      {resource.data !== null && models.length > 0 && view === 'recommended' && (
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {visibleModels.map((model) => (
            <ModelCard key={model.id} model={model} selected={model.id === value} onSelect={() => onChange(model.id)} t={t} />
          ))}
        </ul>
      )}

      {resource.data !== null && models.length > 0 && view === 'all' && (
        <ul className="m-0 flex max-h-80 list-none flex-col gap-2 overflow-y-auto p-0">
          {visibleModels.map((model) => (
            <ModelRow key={model.id} model={model} selected={model.id === value} onSelect={() => onChange(model.id)} t={t} />
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className={`${SECONDARY_BUTTON_SMALL_CLASS} self-start`}
        >
          {t('settings.openrouterModels.showMore')}
        </button>
      )}

      {!selectedIsRecommended && (
        <p data-testid="openrouter-model-warning" className={WARNING_TEXT_CLASS}>
          {t('settings.openrouterModels.warning')}
        </p>
      )}

      <p className={`${HINT_TEXT_CLASS} text-[11px]`}>
        {t('settings.openrouterModels.freeNote')}{' '}
        <a
          href={OPENROUTER_PRIVACY_URL}
          target="_blank"
          rel="noreferrer noopener"
          className={LINK_CLASS}
        >
          {t('settings.openrouterModels.freeNoteLink')}
        </a>
      </p>
    </div>
  );
}
