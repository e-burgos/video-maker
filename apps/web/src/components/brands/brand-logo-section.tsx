import { brandFileUrl } from '../../api/brand-files';
import { withoutKey } from '../../api/brand-manifest-edit';
import { useBrandUpload } from '../../hooks/use-brand-upload';
import type { BrandEditor } from '../../hooks/use-brand-editor';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { OPAQUE_MEDIA_FRAME_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { BRAND_HINT_CLASS, BRAND_ITEM_CLASS, BRAND_ITEM_HEADING_CLASS, BRAND_SMALL_HINT_CLASS } from './brand-controls';
import { BrandFileInput } from './brand-file-input';

const LOGO_ACCEPT = '.svg,.png,image/svg+xml,image/png';
const LOGO_FRAME_CLASS = `${OPAQUE_MEDIA_FRAME_CLASS} flex h-24 items-center justify-center p-3`;

type LogoSlotProps = {
  slot: 'logo' | 'isotipo';
  brandId: string;
  path: string | null;
  editor: BrandEditor;
};

function LogoSlot({ slot, brandId, path, editor }: LogoSlotProps) {
  const t = useT();
  const { uploading, error, upload } = useBrandUpload(brandId);

  async function onFile(file: File): Promise<void> {
    const stored = await upload('logo', file);
    if (stored !== null) {
      await editor.update((current) => ({ ...current, [slot]: stored }));
    }
  }

  return (
    <div data-testid={`brand-${slot}-slot`} className={BRAND_ITEM_CLASS}>
      <h3 className={BRAND_ITEM_HEADING_CLASS}>{slot === 'logo' ? t('brands.logo.logo') : t('brands.logo.isotipo')}</h3>
      {path === null ? (
        <p className={BRAND_SMALL_HINT_CLASS}>{t('brands.logo.noIsotipo')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className={LOGO_FRAME_CLASS}>
            <img
              src={brandFileUrl(brandId, path)}
              alt={t('brands.logo.onDark')}
              data-testid={`brand-${slot}-on-dark`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex h-24 items-center justify-center overflow-hidden rounded-[12px] bg-white p-3">
            <img
              src={brandFileUrl(brandId, path)}
              alt={t('brands.logo.onLight')}
              data-testid={`brand-${slot}-on-light`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
      {!editor.readOnly && (
        <div className="flex flex-col gap-2">
          <BrandFileInput
            label={slot === 'logo' ? t('brands.logo.upload') : t('brands.logo.uploadIsotipo')}
            accept={LOGO_ACCEPT}
            testId={`brand-${slot}-upload`}
            busy={uploading}
            onFile={(file) => void onFile(file)}
          />
          {slot === 'isotipo' && path !== null && (
            <div>
              <button
                type="button"
                data-testid="brand-isotipo-remove"
                className={SECONDARY_BUTTON_SMALL_CLASS}
                onClick={() => void editor.update((current) => withoutKey(current, 'isotipo'))}
              >
                {t('brands.logo.removeIsotipo')}
              </button>
            </div>
          )}
        </div>
      )}
      {error !== null && <ErrorNotice error={error} />}
    </div>
  );
}

export function BrandLogoSection({ editor }: { editor: BrandEditor }) {
  const t = useT();
  const manifest = editor.manifest;
  if (manifest === null) {
    return null;
  }

  return (
    <div data-testid="brand-section-logo" className="flex flex-col gap-4">
      <p className={BRAND_HINT_CLASS}>{t('brands.logo.hint')}</p>
      <LogoSlot slot="logo" brandId={manifest.id} path={manifest.logo} editor={editor} />
      <LogoSlot slot="isotipo" brandId={manifest.id} path={manifest.isotipo ?? null} editor={editor} />
    </div>
  );
}
