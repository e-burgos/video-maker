import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import { brandFileUrl } from '../api/brand-files';
import type { BrandSummary } from '../api/brand-types';
import type { ProjectDetail } from '../api/render-api-types';
import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { BrandPicker } from './brand-picker';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

export type ProjectBrandControlProps = {
  slug: string;
  project: ProjectDetail;
  onChanged: () => void;
};

function CurrentBrand({ brandId, brand, missing }: { brandId: string | null; brand: BrandSummary | undefined; missing: boolean }) {
  const t = useT();
  if (brandId === null) {
    return <span className="text-ink-faint">{t('projectBrand.none')}</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      {brand?.logo != null && (
        <img
          src={brandFileUrl(brand.id, brand.logo)}
          alt={t('brandPicker.logoAlt', { name: brand.name })}
          className="h-5 w-8 rounded bg-slate-950 object-contain"
        />
      )}
      <span className="text-ink">{brand?.name ?? brandId}</span>
      {missing && (
        <span data-testid="project-brand-missing" className="text-warning">
          {t('projectBrand.missing')}
        </span>
      )}
    </span>
  );
}

export function ProjectBrandControl({ slug, project, onChanged }: ProjectBrandControlProps) {
  const t = useT();
  const client = useRenderApi();
  const [open, setOpen] = useState(false);
  const brands = useAsyncResource(
    useCallback(() => client.listBrands(), [client]),
    'project-brand-control-brands',
  );
  const change = useApiAction((brandId: string | null) => client.putProjectBrand(slug, brandId));

  const brandId = project.brand ?? null;
  const current = brands.data?.find((candidate) => candidate.id === brandId);
  const isMotion = project.mode === 'motion';

  async function select(next: string | null) {
    const saved = await change.run(next);
    if (saved !== null) {
      setOpen(false);
      onChanged();
    }
  }

  return (
    <div data-testid="project-brand" className="relative flex items-center gap-2 font-sans text-xs">
      <span className="text-ink-faint">{t('projectBrand.label')}</span>
      <CurrentBrand brandId={brandId} brand={current} missing={project.brandMissing === true} />
      {isMotion ? (
        <Link
          data-testid="project-brand-motion-link"
          to={`/projects/${slug}/motion`}
          className="rounded-md border border-border px-2 py-1 text-ink-muted hover:text-ink"
        >
          {t('projectBrand.changeInBrief')}
        </Link>
      ) : (
      <Button
        data-testid="project-brand-change"
        aria-expanded={open}
        disabled={brands.status !== 'ready'}
        onClick={() => setOpen((value) => !value)}
      >
        {t('projectBrand.change')}
      </Button>
      )}
      {!isMotion && open && brands.data !== null && (
        <div
          data-testid="project-brand-picker"
          className="absolute right-0 top-full z-20 mt-2 w-[28rem] max-w-[90vw] space-y-2 rounded-panel border border-border-strong bg-slate-900 p-3 shadow-lg"
        >
          <BrandPicker
            brands={brands.data}
            value={brandId}
            allowNone
            disabled={change.status === 'pending'}
            name="project-brand-picker"
            onChange={(next) => void select(next)}
          />
          {change.error !== null && <ErrorNotice error={change.error} />}
        </div>
      )}
    </div>
  );
}
