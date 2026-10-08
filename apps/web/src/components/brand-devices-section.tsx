import { brandFileUrl, fileStemSlug, uniqueKey } from '../api/brand-files';
import { withOptionalFlag, withOptionalSpokenName, withoutKey } from '../api/brand-manifest-edit';
import type { BrandDevice, BrandDeviceKind, BrandDevices } from '../api/brand-types';
import { useBrandUpload } from '../hooks/use-brand-upload';
import { useSectionDraft } from '../hooks/use-section-draft';
import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { BRAND_INPUT_CLASS, BrandField } from './brand-field';
import { BrandCornerPicker } from './brand-corner-picker';
import { BrandFileInput } from './brand-file-input';
import { BrandSaveBar } from './brand-save-bar';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

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
    <li
      data-testid={`brand-device-${deviceKey}`}
      className="space-y-3 rounded-lg border border-border-subtle p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-ink-muted">{deviceKey}</span>
        {!readOnly && (
          <Button data-testid={`brand-device-remove-${deviceKey}`} onClick={onRemove}>
            {t('brands.remove')}
          </Button>
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
        <div className="flex items-end gap-4 pb-1.5 text-sm text-ink-muted">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid={`brand-device-plate-${deviceKey}`}
              checked={device.plate === true}
              disabled={readOnly}
              onChange={(event) => onChange(withOptionalFlag(device, 'plate', event.target.checked))}
            />
            {t('brands.devices.plate')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid={`brand-device-retired-${deviceKey}`}
              checked={device.retired === true}
              disabled={readOnly}
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
      {error !== null && <ErrorNotice error={error} />}
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
        <img
          src={brandFileUrl(brandId, device.image)}
          alt={device.name}
          className="max-h-48 rounded-md border border-border-subtle"
        />
      )}
    </li>
  );
}

export function BrandDevicesSection({ editor }: { editor: BrandEditor }) {
  const t = useT();
  const manifest = editor.manifest;
  const savedDevices: BrandDevices = manifest?.devices ?? {};
  const { draft, setDraft, dirty } = useSectionDraft(savedDevices);
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

  const incomplete = Object.values(draft).some((device) => device.name.trim() === '');
  const missingScreen = Object.values(draft).some(
    (device) => device.kind === 'screen' && device.screen === undefined,
  );
  const invalid = incomplete
    ? t('brands.devices.nameRequired')
    : missingScreen
      ? t('brands.devices.screenRequired')
      : null;

  return (
    <div data-testid="brand-section-devices" className="space-y-4">
      <p className="text-sm text-ink-muted">{t('brands.devices.hint')}</p>
      {Object.keys(draft).length === 0 && <p className="text-sm text-ink-faint">{t('brands.devices.empty')}</p>}
      <ul className="space-y-4">
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
      {error !== null && <ErrorNotice error={error} />}
      <BrandSaveBar
        editor={editor}
        dirty={dirty}
        testId="brand-devices-save"
        invalidMessage={invalid}
        onSave={() => void editor.update((current) => ({ ...current, devices: draft }), 'silent')}
      />
    </div>
  );
}
