import { useState } from 'react';

import { fontFamilies } from '../../api/brand-manifest-edit';
import { GOOGLE_FONT_FAMILIES } from '../../api/google-font-families';
import { useRenderApi } from '../../api/render-api-context';
import { RenderApiError, serviceUnreachable } from '../../api/render-api-error';
import { brandFontFamilyName, useBrandFontFaces } from '../../hooks/use-brand-font-faces';
import { useBrandUpload } from '../../hooks/use-brand-upload';
import type { BrandEditor } from '../../hooks/use-brand-editor';
import type { SectionDraft } from '../../hooks/use-section-draft';
import { useT } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';
import { ErrorNotice } from '../error-notice';
import { SECONDARY_BUTTON_CLASS } from '../ui/cl-controls';
import { BRAND_INPUT_CLASS, BRAND_ITEM_CLASS, BRAND_ITEM_HEADING_CLASS, BRAND_SMALL_HINT_CLASS } from './brand-controls';
import type { TypographyDraft } from './brand-draft';
import { BrandField } from './brand-field';
import { BrandFileInput } from './brand-file-input';

const ROLES = ['display', 'body', 'mono'] as const;

const ROLE_LABEL: Readonly<Record<(typeof ROLES)[number], TranslationKey>> = {
  display: 'brands.typography.display',
  body: 'brands.typography.body',
  mono: 'brands.typography.mono',
};

const FONT_ACCEPT = '.woff2,.ttf,.otf';

function GoogleFontAdder({ editor, brandId }: { editor: BrandEditor; brandId: string }) {
  const t = useT();
  const client = useRenderApi();
  const [family, setFamily] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<RenderApiError | null>(null);

  async function add(): Promise<void> {
    const wanted = family.trim();
    if (wanted === '') {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const next = await client.addBrandGoogleFont(brandId, wanted);
      editor.applyDetail(next, true);
      setFamily('');
    } catch (cause) {
      setError(cause instanceof RenderApiError ? cause : serviceUnreachable(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div data-testid="brand-google-font" className={BRAND_ITEM_CLASS}>
      <h3 className={BRAND_ITEM_HEADING_CLASS}>{t('brands.typography.google')}</h3>
      <p className={BRAND_SMALL_HINT_CLASS}>{t('brands.typography.googleHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          list="brand-google-families"
          aria-label={t('brands.typography.googleFamily')}
          data-testid="brand-google-font-family"
          value={family}
          disabled={editor.readOnly || pending}
          onChange={(event) => setFamily(event.target.value)}
          placeholder={t('brands.typography.googlePlaceholder')}
          className={`${BRAND_INPUT_CLASS} max-w-xs flex-1`}
        />
        <datalist id="brand-google-families">
          {GOOGLE_FONT_FAMILIES.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button
          type="button"
          data-testid="brand-google-font-add"
          disabled={editor.readOnly || pending || family.trim() === ''}
          onClick={() => void add()}
          className={SECONDARY_BUTTON_CLASS}
        >
          {pending ? t('brands.typography.googleAdding') : t('brands.typography.googleAdd')}
        </button>
      </div>
      {error !== null && <ErrorNotice error={error} surface="glass" />}
    </div>
  );
}

function FontUploader({ editor, brandId }: { editor: BrandEditor; brandId: string }) {
  const t = useT();
  const { uploading, error, upload } = useBrandUpload(brandId);
  const [family, setFamily] = useState('');

  async function onFile(file: File): Promise<void> {
    const name = family.trim();
    if (name === '') {
      return;
    }
    const stored = await upload('font', file);
    if (stored !== null) {
      await editor.update((current) => ({
        ...current,
        fonts: [...current.fonts.filter((font) => font.family !== name), { family: name, file: stored }],
      }));
      setFamily('');
    }
  }

  return (
    <div data-testid="brand-font-upload" className={BRAND_ITEM_CLASS}>
      <h3 className={BRAND_ITEM_HEADING_CLASS}>{t('brands.typography.upload')}</h3>
      <BrandField label={t('brands.typography.uploadFamily')} hint={t('brands.typography.uploadHint')}>
        <input
          data-testid="brand-font-upload-family"
          value={family}
          disabled={editor.readOnly}
          onChange={(event) => setFamily(event.target.value)}
          className={`${BRAND_INPUT_CLASS} max-w-xs`}
        />
      </BrandField>
      <BrandFileInput
        label={t('brands.typography.uploadFile')}
        accept={FONT_ACCEPT}
        testId="brand-font-upload-file"
        busy={uploading}
        disabled={editor.readOnly || family.trim() === ''}
        onFile={(file) => void onFile(file)}
      />
      {error !== null && <ErrorNotice error={error} surface="glass" />}
    </div>
  );
}

export type BrandTypographySectionProps = { editor: BrandEditor; draft: SectionDraft<TypographyDraft> };

export function BrandTypographySection({ editor, draft: { draft, setDraft } }: BrandTypographySectionProps) {
  const t = useT();
  const manifest = editor.manifest;
  const families = manifest === null ? [] : fontFamilies(manifest);
  const ready = useBrandFontFaces(manifest?.id ?? '', manifest?.fonts ?? []);

  if (manifest === null) {
    return null;
  }

  return (
    <div data-testid="brand-section-typography" className="flex flex-col gap-4">
      {ROLES.map((role) => (
        <div key={role} className="flex flex-col gap-1.5">
          <BrandField label={t(ROLE_LABEL[role])}>
            <select
              data-testid={`brand-typography-${role}`}
              value={draft[role]}
              disabled={editor.readOnly}
              onChange={(event) => setDraft((current) => ({ ...current, [role]: event.target.value }))}
              className={BRAND_INPUT_CLASS}
            >
              {role === 'mono' && <option value="">{t('brands.typography.none')}</option>}
              {families.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </BrandField>
          {draft[role] !== '' && (
            <p
              data-testid={`brand-typography-sample-${role}`}
              style={{
                fontFamily: ready.has(draft[role])
                  ? `"${brandFontFamilyName(manifest.id, draft[role])}", sans-serif`
                  : undefined,
              }}
              className="m-0 text-lg text-[var(--cl-ink)]"
            >
              {t('brands.typography.sample')}
            </p>
          )}
        </div>
      ))}
      <GoogleFontAdder editor={editor} brandId={manifest.id} />
      <FontUploader editor={editor} brandId={manifest.id} />
    </div>
  );
}
