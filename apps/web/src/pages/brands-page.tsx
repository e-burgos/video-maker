import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { BrandSummary } from '../api/brand-types';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { BrandDeleteModal } from '../components/brands/brand-delete-modal';
import { BrandGroup, NewBrandTile } from '../components/brands/brand-groups';
import { BrandNameModal } from '../components/brands/brand-name-modal';
import { ErrorNotice } from '../components/error-notice';
import { useToolbarAction } from '../components/shell/use-toolbar-action';
import { PANEL_CLASS } from '../components/ui/cl-controls';
import { EmptyState } from '../components/ui/status-states';

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

  const openCreate = useCallback(() => setDialog({ kind: 'create' }), []);
  useToolbarAction({ label: t('brands.create'), onClick: openCreate });

  async function createBrand(name: string, duplicateFrom?: string): Promise<void> {
    const created = await client.createBrand(
      duplicateFrom === undefined ? { name } : { name, duplicateFrom },
    );
    navigate(`/brands/${encodeURIComponent(created.id)}`);
  }

  const builtIn = brands.data?.filter((brand) => brand.source === 'built-in') ?? [];
  const user = brands.data?.filter((brand) => brand.source === 'user') ?? [];
  const duplicate = (brand: BrandSummary) => setDialog({ kind: 'duplicate', brand });
  const remove = (brand: BrandSummary) => setDialog({ kind: 'delete', brand });

  return (
    <section data-testid="brands-panel" className={`${PANEL_CLASS} gap-5 shadow-[var(--tucu-shadow-panel)]`}>
      {brands.status === 'loading' && (
        <p data-testid="brands-loading" className="m-0 text-sm text-[var(--cl-ink-2)]">
          {t('brands.loading')}
        </p>
      )}
      {brands.status === 'error' && brands.error !== null && (
        <ErrorNotice error={brands.error} onRetry={brands.reload} />
      )}

      {brands.data !== null && brands.data.length === 0 && (
        <div data-testid="brands-empty">
          <EmptyState title={t('brands.empty')} message={t('brands.empty.hint')} />
        </div>
      )}

      {user.length > 0 && (
        <BrandGroup testId="brands-user" headingKey="brands.group.user" brands={user} onDuplicate={duplicate} onDelete={remove} />
      )}
      {builtIn.length > 0 && (
        <BrandGroup
          testId="brands-built-in"
          headingKey="brands.group.builtIn"
          brands={builtIn}
          onDuplicate={duplicate}
          onDelete={remove}
        />
      )}
      {brands.data !== null && <NewBrandTile onClick={openCreate} />}

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
