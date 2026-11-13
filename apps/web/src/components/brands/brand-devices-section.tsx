import { brandFileUrl, fileStemSlug, uniqueKey } from '../../api/brand-files';
import { withOptionalFlag, withOptionalSpokenName, withoutKey } from '../../api/brand-manifest-edit';
import type { BrandDevice, BrandDeviceKind, BrandDevices } from '../../api/brand-types';
import { useBrandUpload } from '../../hooks/use-brand-upload';
import type { BrandEditor } from '../../hooks/use-brand-editor';
import type { SectionDraft } from '../../hooks/use-section-draft';
import { useT } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';
import { ErrorNotice } from '../error-notice';
import { CHECK_LABEL_CLASS, CHECKBOX_CLASS, OPAQUE_MEDIA_FRAME_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { BRAND_FILE_NAME_CLASS, BRAND_HINT_CLASS, BRAND_INPUT_CLASS, BRAND_ITEM_CLASS } from './brand-controls';
import { BrandCornerPicker } from './brand-corner-picker';
import { BrandField } from './brand-field';
import { BrandFileInput } from './brand-file-input';

const DEVICE_ACCEPT = '.jpg,.jpeg,.png,.webp,.svg';

const KIND_LABEL: Readonly<Record<BrandDeviceKind, TranslationKey>> = {
  counter: 'brands.devices.kind.counter',
  box: 'brands.devices.kind.box',
  screen: 'brands.devices.kind.screen',
};

const KINDS: readonly BrandDeviceKind[] = ['counter', 'box', 'screen'];

type DeviceCardProps = {
  deviceKey: string;
  device: BrandDevice;
  brandId: string;
  readOnly: boolean;
  onChange: (device: BrandDevice) => void;
  onRemove: () => void;
};

function DeviceCard({ deviceKey, device, brandId, readOnly, onChange, onRemove }: DeviceCardProps) {
  const t = useT();
  const { uploading, error, upload } = useBrandUpload(brandId);

  async function replacePhoto(file: File): Promise<void> {
    const stored = await upload('device', file);
    if (stored !== null) {
      onChange({ ...device, image: stored });
    }
  }

  return (
    <li data-testid={`brand-device-${deviceKey}`} className={BRAND_ITEM_CLASS}>
      <div className="flex items-center justify-between gap-3">
        <span className={BRAND_FILE_NAME_CLASS}>{deviceKey}</span>
        {!readOnly && (
          <button
            type="button"
            data-testid={`brand-device-remove-${deviceKey}`}
            className={SECONDARY_BUTTON_SMALL_CLASS}
            onClick={onRemove}
          >
            {t('brands.remove')}
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <BrandField label={t('brands.devices.name')}>
          <input
            data-testid={`brand-device-name-${deviceKey}`}
            value={device.name}
            disabled={readOnly}
            onChange={(event) => onChange({ ...device, name: event.target.value })}
            className={BRAND_INPUT_CLASS}
          />
        </BrandField>
        <BrandField label={t('brands.devices.spokenName')} hint={t('brands.devices.spokenNameHint')}>
          <input
            data-testid={`brand-device-spoken-${deviceKey}`}
            value={device.spokenName ?? ''}
            disabled={readOnly}
            onChange={(event) => onChange(withOptionalSpokenName(device, event.target.value))}
            className={BRAND_INPUT_CLASS}
          />
        </BrandField>
        <BrandField label={t('brands.devices.kind')}>
          <select
            data-testid={`brand-device-kind-${deviceKey}`}
            value={device.kind}
            disabled={readOnly}
            onChange={(event) => onChange({ ...device, kind: event.target.value as BrandDeviceKind })}
            className={BRAND_INPUT_CLASS}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(KIND_LABEL[kind])}
              </option>
            ))}
          </select>
        </BrandField>
        <div className="flex flex-wrap items-end gap-4 pb-2">
          <label className={CHECK_LABEL_CLASS}>
            <input
              type="checkbox"
              data-testid={`brand-device-plate-${deviceKey}`}
              checked={device.plate === true}
              disabled={readOnly}
              className={CHECKBOX_CLASS}
              onChange={(event) => onChange(withOptionalFlag(device, 'plate', event.target.checked))}
            />
            {t('brands.devices.plate')}
          </label>
          <label className={CHECK_LABEL_CLASS}>
            <input
              type="checkbox"
              data-testid={`brand-device-retired-${deviceKey}`}
              checked={device.retired === true}
              disabled={readOnly}
              className={CHECKBOX_CLASS}
              onChange={(event) => onChange(withOptionalFlag(device, 'retired', event.target.checked))}
            />
            {t('brands.devices.retired')}
          </label>
        </div>
      </div>
      {!readOnly && (
        <BrandFileInput
          label={t('brands.devices.replacePhoto')}
          accept={DEVICE_ACCEPT}
          testId={`brand-device-photo-${deviceKey}`}
          busy={uploading}
          onFile={(file) => void replacePhoto(file)}
        />
      )}
      {error !== null && <ErrorNotice error={error} surface="glass" />}
      {device.kind === 'screen' ? (
        <BrandCornerPicker
          imageUrl={brandFileUrl(brandId, device.image)}
          imageAlt={device.name}
          polygon={device.screen?.polygon ?? null}
          disabled={readOnly}
          onPicked={(polygon) => onChange({ ...device, screen: { ...device.screen, polygon } })}
          onReset={() => onChange(withoutKey(device, 'screen'))}
        />
      ) : (
        <div className={`${OPAQUE_MEDIA_FRAME_CLASS} self-start`}>
          <img src={brandFileUrl(brandId, device.image)} alt={device.name} className="block max-h-48 max-w-full" />
        </div>
      )}
    </li>
  );
}

export type BrandDevicesSectionProps = { editor: BrandEditor; draft: SectionDraft<BrandDevices> };

export function BrandDevicesSection({ editor, draft: { draft, setDraft } }: BrandDevicesSectionProps) {
  const t = useT();
  const manifest = editor.manifest;
  const { uploading, error, upload } = useBrandUpload(manifest?.id ?? '');

  if (manifest === null) {
    return null;
  }

  async function onFile(file: File): Promise<void> {
    const stored = await upload('device', file);
    if (stored !== null) {
      const key = uniqueKey(fileStemSlug(file.name), Object.keys(draft));
      setDraft((current) => ({
        ...current,
        [key]: { name: key, image: stored, kind: 'screen' },
      }));
    }
  }

  return (
    <div data-testid="brand-section-devices" className="flex flex-col gap-4">
      <p className={BRAND_HINT_CLASS}>{t('brands.devices.hint')}</p>
      {Object.keys(draft).length === 0 && <p className={BRAND_HINT_CLASS}>{t('brands.devices.empty')}</p>}
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {Object.entries(draft).map(([key, device]) => (
          <DeviceCard
            key={key}
            deviceKey={key}
            device={device}
            brandId={manifest.id}
            readOnly={editor.readOnly}
            onChange={(next) => setDraft((current) => ({ ...current, [key]: next }))}
            onRemove={() => setDraft((current) => withoutKey(current, key))}
          />
        ))}
      </ul>
      {!editor.readOnly && (
        <BrandFileInput
          label={t('brands.devices.add')}
          accept={DEVICE_ACCEPT}
          testId="brand-device-upload"
          busy={uploading}
          onFile={(file) => void onFile(file)}
        />
      )}
      {error !== null && <ErrorNotice error={error} surface="glass" />}
    </div>
  );
}
