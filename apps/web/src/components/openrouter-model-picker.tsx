import { useCallback, useMemo, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
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
      className={`space-y-1 rounded-md border p-3 ${selected ? 'border-sky-400/70 bg-sky-500/10' : 'border-slate-700 bg-slate-950'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-100">{model.name}</span>
        {model.recommendation !== null && (
          <span className="rounded-full border border-slate-600 px-2 py-0.5 font-mono text-[10px] uppercase text-slate-300">
            {t(tierLabelKey(model.recommendation.tier))}
          </span>
        )}
      </div>
      <p className="font-mono text-[11px] text-slate-500">{model.id}</p>
      <p className="text-xs text-slate-400">{priceText(t, model)}</p>
      <p className="text-xs text-slate-500">
        {t(model.supportsImages ? 'settings.openrouterModels.images.yes' : 'settings.openrouterModels.images.no')}
        {' · '}
        {t('settings.openrouterModels.context', { tokens: model.contextLength.toLocaleString('en-US') })}
      </p>
      {model.recommendation !== null && model.recommendation.bench !== null && (
        <p data-testid="openrouter-model-bench" className="text-[11px] text-slate-500">
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
        className="mt-1 rounded-md border border-sky-500/50 bg-sky-500/10 px-2 py-1 text-xs text-sky-100 disabled:opacity-50"
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
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${selected ? 'border-sky-400/70 bg-sky-500/10' : 'border-slate-800'}`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-100">{model.name}</p>
        <p className="truncate font-mono text-[11px] text-slate-500">{model.id}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {model.isFree && (
          <span className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-emerald-300">
            {t('settings.openrouterModels.price.free')}
          </span>
        )}
        <span>{priceText(t, model)}</span>
        <span>{t('settings.openrouterModels.context', { tokens: model.contextLength.toLocaleString('en-US') })}</span>
        <button
          type="button"
          onClick={onSelect}
          disabled={selected}
          className="rounded-md border border-sky-500/50 bg-sky-500/10 px-2 py-1 text-sky-100 disabled:opacity-50"
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
    <div data-testid="openrouter-model-picker" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="openrouter-models-tab-recommended"
          onClick={() => changeView('recommended')}
          className={`rounded-md border px-2 py-1 text-xs ${view === 'recommended' ? 'border-sky-400/70 bg-sky-500/10 text-sky-100' : 'border-slate-700 text-slate-300'}`}
        >
          {t('settings.openrouterModels.tab.recommended')}
        </button>
        <button
          type="button"
          data-testid="openrouter-models-tab-all"
          onClick={() => changeView('all')}
          className={`rounded-md border px-2 py-1 text-xs ${view === 'all' ? 'border-sky-400/70 bg-sky-500/10 text-sky-100' : 'border-slate-700 text-slate-300'}`}
        >
          {t('settings.openrouterModels.tab.all')}
        </button>
      </div>

      {view === 'all' && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={t('settings.openrouterModels.searchPlaceholder')}
            aria-label={t('settings.openrouterModels.searchPlaceholder')}
            className="w-56 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          />
          <label htmlFor="openrouter-models-sort" className="text-xs text-slate-500">
            {t('settings.openrouterModels.sortLabel')}
          </label>
          <select
            id="openrouter-models-sort"
            value={sortChoice}
            onChange={(event) => changeSort(event.target.value as OpenRouterModelSortChoice)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          >
            <option value="default">{t('settings.openrouterModels.sort.default')}</option>
            <option value="price">{t('settings.openrouterModels.sort.price')}</option>
            <option value="name">{t('settings.openrouterModels.sort.name')}</option>
          </select>
        </div>
      )}

      {resource.status === 'loading' && (
        <p className="text-xs text-slate-500">{t('settings.openrouterModels.loading')}</p>
      )}

      {resource.status === 'error' && resource.error !== null && <ErrorNotice error={resource.error} onRetry={resource.reload} />}

      {resource.data !== null && resource.data.stale && (
        <p className="text-xs text-amber-300">{t('settings.openrouterModels.stale')}</p>
      )}

      {resource.data !== null && models.length === 0 && (
        <p className="text-xs text-slate-500">{t('settings.openrouterModels.empty')}</p>
      )}

      {resource.data !== null && models.length > 0 && view === 'recommended' && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visibleModels.map((model) => (
            <ModelCard key={model.id} model={model} selected={model.id === value} onSelect={() => onChange(model.id)} t={t} />
          ))}
        </ul>
      )}

      {resource.data !== null && models.length > 0 && view === 'all' && (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {visibleModels.map((model) => (
            <ModelRow key={model.id} model={model} selected={model.id === value} onSelect={() => onChange(model.id)} t={t} />
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
        >
          {t('settings.openrouterModels.showMore')}
        </button>
      )}

      {!selectedIsRecommended && (
        <p data-testid="openrouter-model-warning" className="text-xs text-amber-300">
          {t('settings.openrouterModels.warning')}
        </p>
      )}

      <p className="text-[11px] text-slate-500">
        {t('settings.openrouterModels.freeNote')}{' '}
        <a
          href={OPENROUTER_PRIVACY_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sky-300 underline hover:text-sky-200"
        >
          {t('settings.openrouterModels.freeNoteLink')}
        </a>
      </p>
    </div>
  );
}
