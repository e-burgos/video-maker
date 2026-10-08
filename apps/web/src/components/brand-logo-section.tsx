import { brandFileUrl } from '../api/brand-files';
import { withoutKey } from '../api/brand-manifest-edit';
import { useBrandUpload } from '../hooks/use-brand-upload';
import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import { BrandFileInput } from './brand-file-input';
import { BrandSaveStatus } from './brand-save-bar';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

const LOGO_ACCEPT = '.svg,.png,image/svg+xml,image/png';

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
    <div data-testid={`brand-${slot}-slot`} className="space-y-3 rounded-lg border border-border-subtle p-4">
      <h3 className="text-sm font-medium text-ink">
        {slot === 'logo' ? t('brands.logo.logo') : t('brands.logo.isotipo')}
      </h3>
      {path === null ? (
        <p className="text-xs text-ink-faint">{t('brands.logo.noIsotipo')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex h-24 items-center justify-center rounded-md bg-slate-950 p-3">
            <img
              src={brandFileUrl(brandId, path)}
              alt={t('brands.logo.onDark')}
              data-testid={`brand-${slot}-on-dark`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex h-24 items-center justify-center rounded-md bg-white p-3">
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
        <div className="space-y-2">
          <BrandFileInput
            label={slot === 'logo' ? t('brands.logo.upload') : t('brands.logo.uploadIsotipo')}
            accept={LOGO_ACCEPT}
            testId={`brand-${slot}-upload`}
            busy={uploading}
            onFile={(file) => void onFile(file)}
          />
          {slot === 'isotipo' && path !== null && (
            <Button
              data-testid="brand-isotipo-remove"
              onClick={() => void editor.update((current) => withoutKey(current, 'isotipo'))}
            >
              {t('brands.logo.removeIsotipo')}
            </Button>
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
    <div data-testid="brand-section-logo" className="space-y-4">
      <p className="text-sm text-ink-muted">{t('brands.logo.hint')}</p>
      <LogoSlot slot="logo" brandId={manifest.id} path={manifest.logo} editor={editor} />
      <LogoSlot slot="isotipo" brandId={manifest.id} path={manifest.isotipo ?? null} editor={editor} />
      <BrandSaveStatus editor={editor} />
      {editor.saveError !== null && <ErrorNotice error={editor.saveError} />}
    </div>
  );
}
