import { Link } from 'react-router-dom';

import { assetRoleCopy, isKnownAssetRole } from '../api/asset-roles';
import { PRODUCER_RECIPES, loadRecipePrompt } from '../api/producer-recipes';
import type { ProducerRecipeId } from '../api/producer-recipes';
import { ASSET_ROLES } from '../api/render-api-types';
import type { AssetListing } from '../api/render-api-types';
import { useLanguage, useT, useTn } from '../i18n/language-context';
import type { TranslateFn } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';

export type ProducerWelcomeProps = {
  slug: string;
  assets: AssetListing | null;
  onDraft: (text: string) => void;
  hasTimedScript?: boolean;
};

export type InventoryEntry = {
  role: string;
  count: number;
};

export const STARTER_KEYS_WITH_MATERIAL = [
  'producer.starter.platform',
  'producer.starter.script',
  'producer.starter.narrate',
  'producer.starter.short',
] as const satisfies readonly TranslationKey[];

export const STARTER_KEYS_WITHOUT_MATERIAL = [
  'producer.starter.platform',
  'producer.starter.freeFootage',
] as const satisfies readonly TranslationKey[];

export function inventoryOf(assets: AssetListing | null): InventoryEntry[] {
  if (assets === null) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const asset of assets.assets) {
    counts.set(asset.role, (counts.get(asset.role) ?? 0) + 1);
  }

  const known = ASSET_ROLES.filter((role) => counts.has(role)).map((role) => ({
    role: role as string,
    count: counts.get(role) as number,
  }));
  const extra = [...counts.keys()]
    .filter((role) => !(ASSET_ROLES as readonly string[]).includes(role))
    .sort()
    .map((role) => ({ role, count: counts.get(role) as number }));

  return [...known, ...extra];
}

function inventoryLabel(role: string, t: TranslateFn): string {
  return isKnownAssetRole(role) ? t(assetRoleCopy(role).shortNameKey) : role;
}

export function ProducerWelcome({ slug, assets, onDraft, hasTimedScript = false }: ProducerWelcomeProps) {
  const t = useT();
  const tn = useTn();
  const { language } = useLanguage();
  const inventory = inventoryOf(assets);
  const hasMaterial = inventory.length > 0;
  const starterKeys = hasMaterial ? STARTER_KEYS_WITH_MATERIAL : STARTER_KEYS_WITHOUT_MATERIAL;

  async function draftRecipe(id: ProducerRecipeId) {
    onDraft(await loadRecipePrompt(id, language, { hasTimedScript }));
  }

  return (
    <div
      data-testid="producer-welcome"
      className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-5"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          {t('producer.welcomeTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{t('producer.welcomeBody', { slug })}</p>
      </div>

      <div data-testid="producer-inventory" className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('producer.inventoryHeading')}
        </p>
        {hasMaterial ? (
          <ul className="flex flex-wrap gap-2">
            {inventory.map((entry) => (
              <li
                key={entry.role}
                data-role={entry.role}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                {inventoryLabel(entry.role, t)} · {tn('workspace.material.fileCount', entry.count)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-amber-200">
            {t('producer.noMaterialBefore')}{' '}
            <Link
              to={`/projects/${encodeURIComponent(slug)}/library`}
              className="text-sky-300 underline hover:text-sky-200"
            >
              {t('producer.noMaterialLink')}
            </Link>{' '}
            {t('producer.noMaterialAfter')}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('producer.recipesHeading')}
        </p>
        <ul data-testid="producer-recipes" className="grid gap-2 sm:grid-cols-3">
          {PRODUCER_RECIPES.map((recipe) => (
            <li
              key={recipe.id}
              className="space-y-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-2.5"
            >
              <button
                type="button"
                data-recipe={recipe.id}
                title={t(recipe.descriptionKey)}
                onClick={() => void draftRecipe(recipe.id)}
                className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100"
              >
                {t(recipe.labelKey)}
              </button>
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <p className="line-clamp-1 text-xs text-slate-500 group-open:line-clamp-none">
                    {t(recipe.descriptionKey)}
                  </p>
                  <span className="text-[11px] font-medium text-sky-300">
                    {t('workspace.recipes.toggle')}
                  </span>
                </summary>
              </details>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-slate-500">
          {t('producer.startersHeading')}
        </p>
        <ul data-testid="producer-starters" className="flex flex-wrap gap-2">
          {starterKeys.map((starterKey) => {
            const suggestion = t(starterKey);
            return (
              <li key={starterKey}>
                <button
                  type="button"
                  onClick={() => onDraft(suggestion)}
                  className="rounded-full border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-xs text-sky-100"
                >
                  {suggestion.trim()}
                  {suggestion.endsWith(' ') ? '…' : ''}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-500">
          {t('producer.startersHint')}{' '}
          <Link to="/guide" className="text-sky-300 underline hover:text-sky-200">
            {t('guide.howDoesThisWork')}
          </Link>
        </p>
      </div>
    </div>
  );
}
