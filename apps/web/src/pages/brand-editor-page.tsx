import { StateBadge } from '@e-burgos/tucu-ui';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useRenderApi } from '../api/render-api-context';
import { useBrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import { BrandEditorNav } from '../components/brands/brand-editor-nav';
import { BrandNameModal } from '../components/brands/brand-name-modal';
import { BrandPreviewPane } from '../components/brands/brand-preview-pane';
import { BrandSaveBar } from '../components/brands/brand-save-bar';
import { BrandSectionBody } from '../components/brands/brand-section-body';
import { BRAND_SECTIONS, sectionLabelKey } from '../components/brands/brand-sections';
import type { BrandSectionId } from '../components/brands/brand-sections';
import { useBrandDraft } from '../components/brands/use-brand-draft';
import { ErrorNotice } from '../components/error-notice';
import { PANEL_CLASS, PANEL_HEADING_CLASS, SECONDARY_BUTTON_CLASS } from '../components/ui/cl-controls';

const BACK_LINK_CLASS = 'focus-cl rounded text-sm text-[var(--cl-action-text)] underline hover:text-[var(--cl-action-hover)]';

export function BrandEditorPage() {
  const { id = '' } = useParams<{ id: string }>();
  const t = useT();
  const client = useRenderApi();
  const navigate = useNavigate();
  const editor = useBrandEditor(id);
  const draft = useBrandDraft(editor);
  const [section, setSection] = useState<BrandSectionId>('identity');
  const [duplicating, setDuplicating] = useState(false);
  const active = BRAND_SECTIONS.find((candidate) => candidate.id === section) ?? BRAND_SECTIONS[0];

  if (editor.status === 'loading') {
    return (
      <p data-testid="brand-editor-loading" className="text-sm text-[var(--cl-ink-2)]">
        {t('brands.loading')}
      </p>
    );
  }

  if (editor.status === 'error' || editor.manifest === null || editor.detail === null || active === undefined) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Link to="/brands" className={BACK_LINK_CLASS}>
          {t('brands.back')}
        </Link>
        {editor.loadError !== null && <ErrorNotice error={editor.loadError} onRetry={editor.reload} />}
      </div>
    );
  }

  return (
    <section data-testid="brand-editor" className="flex min-h-full min-w-0 flex-col gap-3">
      <header className="glass flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[20px] p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link to="/brands" className={BACK_LINK_CLASS}>
            {t('brands.back')}
          </Link>
          <h2 className="m-0 min-w-0 truncate text-lg font-bold text-[var(--cl-ink)]">{editor.manifest.name}</h2>
          <StateBadge tone={editor.readOnly ? 'neutral' : 'teal'} size="sm">
            {editor.readOnly ? t('brands.source.builtIn') : t('brands.source.user')}
          </StateBadge>
        </div>
        {editor.readOnly && (
          <div data-testid="brand-readonly-banner" className="flex flex-wrap items-center gap-3">
            <p className="m-0 text-sm text-[var(--tucu-state-orange-ink)]">{t('brands.readonly')}</p>
            <button
              type="button"
              data-testid="brand-readonly-duplicate"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setDuplicating(true)}
            >
              {t('brands.duplicate')}
            </button>
          </div>
        )}
      </header>

      <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-3 min-[1280px]:grid-cols-[176px_minmax(0,1fr)_340px]">
        <BrandEditorNav active={section} dirtyBySection={draft.dirtyBySection} onSelect={setSection} />
        <section className={`${PANEL_CLASS} gap-4`}>
          <h2 className={PANEL_HEADING_CLASS}>{t(sectionLabelKey(active.id))}</h2>
          <BrandSectionBody id={active.id} editor={editor} draft={draft} />
        </section>
        <aside className="min-w-0 min-[1280px]:sticky min-[1280px]:top-0">
          <BrandPreviewPane brandId={id} signal={editor.previewSignal} />
        </aside>
      </div>

      {!editor.readOnly && <BrandSaveBar editor={editor} draft={draft} />}

      {duplicating && (
        <BrandNameModal
          testId="brand-duplicate-modal"
          title={t('brands.duplicate.title', { name: editor.manifest.name })}
          description={t('brands.duplicate.explanation')}
          initialName={t('brands.duplicate.suggestion', { name: editor.manifest.name })}
          submitLabel={t('brands.duplicate.submit')}
          onClose={() => setDuplicating(false)}
          onSubmit={async (name) => {
            const created = await client.createBrand({ name, duplicateFrom: id });
            navigate(`/brands/${encodeURIComponent(created.id)}`);
          }}
        />
      )}
    </section>
  );
}
