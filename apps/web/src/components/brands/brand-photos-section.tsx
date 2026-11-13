import { brandFileUrl, fileStemSlug, uniqueKey } from '../../api/brand-files';
import type { PhotoRow } from '../../api/brand-photo-rows';
import { useBrandUpload } from '../../hooks/use-brand-upload';
import type { BrandEditor } from '../../hooks/use-brand-editor';
import type { SectionDraft } from '../../hooks/use-section-draft';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { OPAQUE_MEDIA_FRAME_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { BRAND_HINT_CLASS, BRAND_ITEM_CLASS, BRAND_TEXTAREA_CLASS } from './brand-controls';
import { BrandField } from './brand-field';
import { BrandFileInput } from './brand-file-input';

const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,.svg';

export type BrandPhotosSectionProps = { editor: BrandEditor; draft: SectionDraft<PhotoRow[]> };

export function BrandPhotosSection({ editor, draft: { draft, setDraft } }: BrandPhotosSectionProps) {
  const t = useT();
  const manifest = editor.manifest;
  const { uploading, error, upload } = useBrandUpload(manifest?.id ?? '');

  if (manifest === null) {
    return null;
  }

  async function onFile(file: File): Promise<void> {
    const stored = await upload('image', file);
    if (stored !== null) {
      setDraft((current) => [
        ...current,
        {
          key: uniqueKey(
            fileStemSlug(file.name),
            current.map((row) => row.key),
          ),
          file: stored,
          caption: '',
        },
      ]);
    }
  }

  return (
    <div data-testid="brand-section-photos" className="flex flex-col gap-4">
      <p className={BRAND_HINT_CLASS}>{t('brands.photos.hint')}</p>
      {draft.length === 0 && <p className={BRAND_HINT_CLASS}>{t('brands.photos.empty')}</p>}
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
        {draft.map((row) => (
          <li key={row.key} data-testid={`brand-photo-${row.key}`} className={BRAND_ITEM_CLASS}>
            <div className={OPAQUE_MEDIA_FRAME_CLASS}>
              <img
                src={brandFileUrl(manifest.id, row.file)}
                alt={row.caption === '' ? row.key : row.caption}
                className="h-32 w-full bg-[#0b0d14] object-cover"
              />
            </div>
            <BrandField label={t('brands.photos.caption')}>
              <textarea
                rows={2}
                data-testid={`brand-photo-caption-${row.key}`}
                value={row.caption}
                disabled={editor.readOnly}
                onChange={(event) =>
                  setDraft((current) =>
                    current.map((candidate) =>
                      candidate.key === row.key ? { ...candidate, caption: event.target.value } : candidate,
                    ),
                  )
                }
                className={BRAND_TEXTAREA_CLASS}
              />
            </BrandField>
            {!editor.readOnly && (
              <div>
                <button
                  type="button"
                  data-testid={`brand-photo-remove-${row.key}`}
                  className={SECONDARY_BUTTON_SMALL_CLASS}
                  onClick={() => setDraft((current) => current.filter((candidate) => candidate.key !== row.key))}
                >
                  {t('brands.remove')}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!editor.readOnly && (
        <BrandFileInput
          label={t('brands.photos.upload')}
          accept={PHOTO_ACCEPT}
          testId="brand-photo-upload"
          busy={uploading}
          onFile={(file) => void onFile(file)}
        />
      )}
      {error !== null && <ErrorNotice error={error} surface="glass" />}
    </div>
  );
}
