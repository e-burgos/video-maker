import { useEffect, useState } from 'react';

import { PALETTE_KEYS, effectivePalette, isHexColor } from '../api/brand-files';
import { withPaletteColor, withTokenOverride, withoutTokenOverride } from '../api/brand-manifest-edit';
import type { BrandPalette } from '../api/brand-types';
import type { BrandEditor } from '../hooks/use-brand-editor';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { BRAND_INPUT_CLASS } from './brand-field';
import { BrandSaveStatus } from './brand-save-bar';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';

const PALETTE_LABEL: Readonly<Record<keyof BrandPalette, TranslationKey>> = {
  background: 'brands.colors.background',
  accent: 'brands.colors.accent',
  accent2: 'brands.colors.accent2',
  text: 'brands.colors.text',
};

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
    <div className="space-y-1">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          data-testid={`brand-color-${paletteKey}`}
          value={isHexColor(value) ? value : '#000000'}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded-control border border-border-strong bg-surface disabled:opacity-50"
        />
        <input
          aria-label={`${label} hex`}
          data-testid={`brand-color-${paletteKey}-hex`}
          value={text}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          className={`${BRAND_INPUT_CLASS} max-w-28 font-mono`}
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
    <li data-testid={`brand-token-${name}`} className="flex items-center gap-2">
      <code className="w-48 shrink-0 truncate text-xs text-ink-muted" title={name}>
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
        className={`${BRAND_INPUT_CLASS} font-mono text-xs`}
      />
      {overridden && !disabled && (
        <Button data-testid={`brand-token-reset-${name}`} onClick={onReset}>
          {t('brands.colors.resetToken')}
        </Button>
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
    <div data-testid="brand-section-colors" className="space-y-4">
      <p className="text-sm text-ink-muted">{t('brands.colors.hint')}</p>
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
      <BrandSaveStatus editor={editor} />
      {editor.saveError !== null && <ErrorNotice error={editor.saveError} />}

      <details data-testid="brand-colors-advanced" className="rounded-lg border border-border-subtle p-3">
        <summary className="cursor-pointer text-sm text-ink-muted">{t('brands.colors.advanced')}</summary>
        <p className="mt-2 text-xs text-ink-faint">{t('brands.colors.advancedHint')}</p>
        <ul className="mt-3 space-y-2">
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
