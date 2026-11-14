import { useEffect, useState } from 'react';

import { PALETTE_KEYS, effectivePalette, isHexColor } from '../../api/brand-files';
import { withPaletteColor, withTokenOverride, withoutTokenOverride } from '../../api/brand-manifest-edit';
import type { BrandPalette } from '../../api/brand-types';
import type { BrandEditor } from '../../hooks/use-brand-editor';
import { useT } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';
import { FIELD_LABEL_CLASS, FIELD_SMALL_CLASS, SECONDARY_BUTTON_SMALL_CLASS } from '../ui/cl-controls';
import { BRAND_HINT_CLASS, BRAND_INPUT_CLASS, BRAND_SMALL_HINT_CLASS } from './brand-controls';

const PALETTE_LABEL: Readonly<Record<keyof BrandPalette, TranslationKey>> = {
  background: 'brands.colors.background',
  accent: 'brands.colors.accent',
  accent2: 'brands.colors.accent2',
  text: 'brands.colors.text',
};

const SWATCH_INPUT_CLASS =
  'focus-cl h-10 w-12 shrink-0 cursor-pointer rounded-[10px] border border-[var(--tucu-glass-sub-line)] bg-transparent p-1 disabled:opacity-50';

type ColorFieldProps = {
  paletteKey: keyof BrandPalette;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

function ColorField({ paletteKey, label, value, disabled, onChange }: ColorFieldProps) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  function commit(candidate: string): void {
    setText(candidate);
    if (isHexColor(candidate) && candidate.toLowerCase() !== value.toLowerCase()) {
      onChange(candidate);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="color"
          aria-label={label}
          data-testid={`brand-color-${paletteKey}`}
          value={isHexColor(value) ? value : '#000000'}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          className={SWATCH_INPUT_CLASS}
        />
        <input
          aria-label={`${label} hex`}
          data-testid={`brand-color-${paletteKey}-hex`}
          value={text}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          className={`${BRAND_INPUT_CLASS} font-data min-w-0`}
        />
      </div>
    </div>
  );
}

type TokenRowProps = {
  name: string;
  value: string;
  overridden: boolean;
  disabled: boolean;
  onCommit: (value: string) => void;
  onReset: () => void;
};

function TokenRow({ name, value, overridden, disabled, onCommit, onReset }: TokenRowProps) {
  const t = useT();
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  function commit(): void {
    if (text.trim() !== '' && text !== value) {
      onCommit(text.trim());
    }
  }

  return (
    <li data-testid={`brand-token-${name}`} className="flex min-w-0 flex-wrap items-center gap-2">
      <code className="font-data w-44 shrink-0 truncate text-xs text-[var(--cl-ink-2)]" title={name}>
        {name}
      </code>
      <input
        aria-label={name}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
          }
        }}
        className={`${FIELD_SMALL_CLASS} font-data min-w-0 flex-1`}
      />
      {overridden && !disabled && (
        <button
          type="button"
          data-testid={`brand-token-reset-${name}`}
          className={SECONDARY_BUTTON_SMALL_CLASS}
          onClick={onReset}
        >
          {t('brands.colors.resetToken')}
        </button>
      )}
    </li>
  );
}

export function BrandColorsSection({ editor }: { editor: BrandEditor }) {
  const t = useT();
  const manifest = editor.manifest;
  const detail = editor.detail;
  if (manifest === null || detail === null) {
    return null;
  }
  const palette = { ...effectivePalette(manifest, detail.tokens), ...manifest.palette };
  const overrides = manifest.tokens ?? {};
  const tokenNames = Object.keys(detail.tokens).sort();

  return (
    <div data-testid="brand-section-colors" className="flex flex-col gap-4">
      <p className={BRAND_HINT_CLASS}>{t('brands.colors.hint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {PALETTE_KEYS.map((key) => (
          <ColorField
            key={key}
            paletteKey={key}
            label={t(PALETTE_LABEL[key])}
            value={palette[key]}
            disabled={editor.readOnly}
            onChange={(value) =>
              void editor.update((current) => withPaletteColor(current, detail.tokens, key, value), 'live')
            }
          />
        ))}
      </div>

      <details data-testid="brand-colors-advanced" className="glass-sub rounded-[14px] p-3.5">
        <summary className="focus-cl cursor-pointer text-sm font-semibold text-[var(--cl-ink)]">
          {t('brands.colors.advanced')}
        </summary>
        <p className={`${BRAND_SMALL_HINT_CLASS} mt-2`}>{t('brands.colors.advancedHint')}</p>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {tokenNames.map((name) => (
            <TokenRow
              key={name}
              name={name}
              value={detail.tokens[name] ?? ''}
              overridden={Object.prototype.hasOwnProperty.call(overrides, name)}
              disabled={editor.readOnly}
              onCommit={(value) => void editor.update((current) => withTokenOverride(current, name, value), 'live')}
              onReset={() => void editor.update((current) => withoutTokenOverride(current, name), 'live')}
            />
          ))}
        </ul>
      </details>
    </div>
  );
}
