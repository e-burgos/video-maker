import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useBrandEditor } from '../hooks/use-brand-editor';
import { useRenderApi } from '../api/render-api-context';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { BrandColorsSection } from '../components/brand-colors-section';
import { BrandDevicesSection } from '../components/brand-devices-section';
import { BrandIdentitySection } from '../components/brand-identity-section';
import { BrandLogoSection } from '../components/brand-logo-section';
import { BrandMusicSection } from '../components/brand-music-section';
import { BrandNameModal } from '../components/brand-name-modal';
import { BrandPhotosSection } from '../components/brand-photos-section';
import { BrandPreviewPane } from '../components/brand-preview-pane';
import { BrandTypographySection } from '../components/brand-typography-section';
import { BrandVoiceSection } from '../components/brand-voice-section';
import { ErrorNotice } from '../components/error-notice';
import { Button } from '../components/ui/button';
import type { BrandEditor } from '../hooks/use-brand-editor';
import type { ComponentType } from 'react';

type SectionId = 'identity' | 'logo' | 'colors' | 'typography' | 'voice' | 'music' | 'photos' | 'devices';

const SECTIONS: readonly { id: SectionId; labelKey: TranslationKey; Component: ComponentType<{ editor: BrandEditor }> }[] = [
  { id: 'identity', labelKey: 'brands.section.identity', Component: BrandIdentitySection },
  { id: 'logo', labelKey: 'brands.section.logo', Component: BrandLogoSection },
  { id: 'colors', labelKey: 'brands.section.colors', Component: BrandColorsSection },
  { id: 'typography', labelKey: 'brands.section.typography', Component: BrandTypographySection },
  { id: 'voice', labelKey: 'brands.section.voice', Component: BrandVoiceSection },
  { id: 'music', labelKey: 'brands.section.music', Component: BrandMusicSection },
  { id: 'photos', labelKey: 'brands.section.photos', Component: BrandPhotosSection },
  { id: 'devices', labelKey: 'brands.section.devices', Component: BrandDevicesSection },
];

export function BrandEditorPage() {
  const { id = '' } = useParams<{ id: string }>();
  const t = useT();
  const client = useRenderApi();
  const navigate = useNavigate();
  const editor = useBrandEditor(id);
  const [section, setSection] = useState<SectionId>('identity');
  const [duplicating, setDuplicating] = useState(false);
  const active = SECTIONS.find((candidate) => candidate.id === section) ?? SECTIONS[0];

  if (editor.status === 'loading') {
    return (
      <p data-testid="brand-editor-loading" className="text-sm text-ink-faint">
        {t('brands.loading')}
      </p>
    );
  }

  if (editor.status === 'error' || editor.manifest === null || editor.detail === null || active === undefined) {
    return (
      <div className="space-y-3">
        <Link to="/brands" className="text-sm text-accent-strong underline">
          {t('brands.back')}
        </Link>
        {editor.loadError !== null && <ErrorNotice error={editor.loadError} onRetry={editor.reload} />}
      </div>
    );
  }

  const ActiveSection = active.Component;

  return (
    <section data-testid="brand-editor" className="space-y-5">
      <header className="space-y-2">
        <Link to="/brands" className="text-sm text-accent-strong underline">
          {t('brands.back')}
        </Link>
        <h1 className="text-xl font-semibold text-ink">{editor.manifest.name}</h1>
      </header>

      {editor.readOnly && (
        <div
          data-testid="brand-readonly-banner"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3"
        >
          <p className="text-sm text-warning">{t('brands.readonly')}</p>
          <Button data-testid="brand-readonly-duplicate" onClick={() => setDuplicating(true)}>
            {t('brands.duplicate')}
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 gap-5">
          <nav aria-label={t('brands.sections')} className="flex w-32 shrink-0 flex-col gap-1">
            {SECTIONS.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                data-testid={`brand-nav-${candidate.id}`}
                aria-current={candidate.id === section ? 'page' : undefined}
                onClick={() => setSection(candidate.id)}
                className={`rounded-control border px-3 py-1.5 text-left text-sm ${
                  candidate.id === section
                    ? 'border-sky-500/60 bg-sky-500/10 text-sky-100'
                    : 'border-border-subtle text-ink-muted hover:border-border-strong'
                }`}
              >
                {t(candidate.labelKey)}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1">
            <ActiveSection editor={editor} />
          </div>
        </div>
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <BrandPreviewPane brandId={id} signal={editor.previewSignal} />
        </aside>
      </div>

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
