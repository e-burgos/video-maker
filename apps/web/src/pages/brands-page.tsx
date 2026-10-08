import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { BrandSummary } from '../api/brand-types';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { BrandCard } from '../components/brand-card';
import { BrandDeleteModal } from '../components/brand-delete-modal';
import { BrandNameModal } from '../components/brand-name-modal';
import { ErrorNotice } from '../components/error-notice';
import { Button } from '../components/ui/button';

type Dialog =
  | { kind: 'create' }
  | { kind: 'duplicate'; brand: BrandSummary }
  | { kind: 'delete'; brand: BrandSummary }
  | null;

export function BrandsPage() {
  const client = useRenderApi();
  const navigate = useNavigate();
  const t = useT();
  const brands = useAsyncResource(useCallback(() => client.listBrands(), [client]), 'brands');
  const [dialog, setDialog] = useState<Dialog>(null);

  async function createBrand(name: string, duplicateFrom?: string): Promise<void> {
    const created = await client.createBrand(
      duplicateFrom === undefined ? { name } : { name, duplicateFrom },
    );
    navigate(`/brands/${encodeURIComponent(created.id)}`);
  }

  const builtIn = brands.data?.filter((brand) => brand.source === 'built-in') ?? [];
  const user = brands.data?.filter((brand) => brand.source === 'user') ?? [];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{t('brands.title')}</h1>
          <p className="text-sm text-ink-muted">{t('brands.subtitle')}</p>
        </div>
        <Button variant="primary" data-testid="brand-create" onClick={() => setDialog({ kind: 'create' })}>
          {t('brands.create')}
        </Button>
      </header>

      {brands.status === 'loading' && (
        <p data-testid="brands-loading" className="text-sm text-ink-faint">
          {t('brands.loading')}
        </p>
      )}
      {brands.status === 'error' && brands.error !== null && (
        <ErrorNotice error={brands.error} onRetry={brands.reload} />
      )}

      {brands.data !== null && brands.data.length === 0 && (
        <p data-testid="brands-empty" className="text-sm text-ink-faint">
          {t('brands.empty')}
        </p>
      )}

      {user.length > 0 && (
        <div data-testid="brands-user" className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-ink-faint">{t('brands.group.user')}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {user.map((brand) => (
              <li key={brand.id}>
                <BrandCard
                  brand={brand}
                  onDuplicate={(target) => setDialog({ kind: 'duplicate', brand: target })}
                  onDelete={(target) => setDialog({ kind: 'delete', brand: target })}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {builtIn.length > 0 && (
        <div data-testid="brands-built-in" className="space-y-3">
          <h2 className="text-xs font-medium tracking-wide text-ink-faint">{t('brands.group.builtIn')}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {builtIn.map((brand) => (
              <li key={brand.id}>
                <BrandCard
                  brand={brand}
                  onDuplicate={(target) => setDialog({ kind: 'duplicate', brand: target })}
                  onDelete={(target) => setDialog({ kind: 'delete', brand: target })}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {dialog?.kind === 'create' && (
        <BrandNameModal
          testId="brand-create-modal"
          title={t('brands.create.title')}
          description={t('brands.create.explanation')}
          initialName=""
          submitLabel={t('brands.create.submit')}
          onClose={() => setDialog(null)}
          onSubmit={(name) => createBrand(name)}
        />
      )}
      {dialog?.kind === 'duplicate' && (
        <BrandNameModal
          testId="brand-duplicate-modal"
          title={t('brands.duplicate.title', { name: dialog.brand.name })}
          description={t('brands.duplicate.explanation')}
          initialName={t('brands.duplicate.suggestion', { name: dialog.brand.name })}
          submitLabel={t('brands.duplicate.submit')}
          onClose={() => setDialog(null)}
          onSubmit={(name) => createBrand(name, dialog.brand.id)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <BrandDeleteModal
          brand={dialog.brand}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDialog(null);
            brands.reload();
          }}
        />
      )}
    </section>
  );
}
