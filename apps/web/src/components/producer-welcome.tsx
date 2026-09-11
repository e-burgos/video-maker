import { Link } from 'react-router-dom';

import { ASSET_ROLES } from '../api/render-api-types';
import type { AssetListing } from '../api/render-api-types';

export type ProducerWelcomeProps = {
  slug: string;
  assets: AssetListing | null;
  onDraft: (text: string) => void;
};

export type InventoryEntry = {
  role: string;
  count: number;
};

export const STARTER_SUGGESTIONS_WITH_MATERIAL = [
  'Contame qué video querés y para qué plataforma',
  'Proponeme un guion con el material que subí',
  'Narrá esta grabación con una voz generada',
  'Hacé un video de 30 s sobre ',
] as const;

export const STARTER_SUGGESTIONS_WITHOUT_MATERIAL = [
  'Contame qué video querés y para qué plataforma',
  'Buscá material libre sobre ',
] as const;

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

export function ProducerWelcome({ slug, assets, onDraft }: ProducerWelcomeProps) {
  const inventory = inventoryOf(assets);
  const hasMaterial = inventory.length > 0;
  const suggestions = hasMaterial
    ? STARTER_SUGGESTIONS_WITH_MATERIAL
    : STARTER_SUGGESTIONS_WITHOUT_MATERIAL;

  return (
    <div
      data-testid="producer-welcome"
      className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-5"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">
          Tell the producer what you want to make
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          It works with the material of{' '}
          <span className="font-mono text-slate-200">{slug}</span>, agrees the script with you and
          then edits, voices and renders the video on this machine.
        </p>
      </div>

      <div data-testid="producer-inventory" className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-slate-500">
          material in this project
        </p>
        {hasMaterial ? (
          <ul className="flex flex-wrap gap-2">
            {inventory.map((entry) => (
              <li
                key={entry.role}
                data-role={entry.role}
                className="rounded-md border border-slate-700 px-2 py-1 font-mono text-xs text-slate-300"
              >
                {entry.role} · {entry.count}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-amber-200">
            No raw material yet.{' '}
            <Link
              to={`/projects/${encodeURIComponent(slug)}`}
              className="text-sky-300 underline hover:text-sky-200"
            >
              Upload your clips, photos, music or logo
            </Link>{' '}
            and the producer will work with them. It can also look for free material for you.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-slate-500">
          start with one of these
        </p>
        <ul data-testid="producer-starters" className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => onDraft(suggestion)}
                className="rounded-full border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-xs text-sky-100"
              >
                {suggestion.trim()}
                {suggestion.endsWith(' ') ? '…' : ''}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          A starter lands in the box below so you can finish it in your own words.
        </p>
      </div>
    </div>
  );
}
