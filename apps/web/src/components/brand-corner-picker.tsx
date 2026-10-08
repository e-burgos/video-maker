import { useRef, useState } from 'react';

import { percentPoint } from '../api/brand-files';
import type { BrandScreenPoint } from '../api/brand-types';
import { useT } from '../i18n/language-context';
import type { TranslationKey } from '../i18n/messages-en';
import { Button } from './ui/button';

const CORNER_LABEL: readonly TranslationKey[] = [
  'brands.devices.corner.topLeft',
  'brands.devices.corner.topRight',
  'brands.devices.corner.bottomRight',
  'brands.devices.corner.bottomLeft',
];

export type BrandCornerPickerProps = {
  imageUrl: string;
  imageAlt: string;
  polygon: readonly BrandScreenPoint[] | null;
  disabled: boolean;
  onPicked: (polygon: BrandScreenPoint[]) => void;
  onReset: () => void;
};

export function BrandCornerPicker({ imageUrl, imageAlt, polygon, disabled, onPicked, onReset }: BrandCornerPickerProps) {
  const t = useT();
  const surface = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<BrandScreenPoint[]>([]);
  const points = polygon ?? pending;
  const complete = polygon !== null;

  function pick(event: React.MouseEvent<HTMLDivElement>): void {
    if (disabled || complete || surface.current === null) {
      return;
    }
    const point = percentPoint(event.clientX, event.clientY, surface.current.getBoundingClientRect());
    const next = [...pending, point];
    if (next.length === 4) {
      setPending([]);
      onPicked(next);
    } else {
      setPending(next);
    }
  }

  function reset(): void {
    setPending([]);
    onReset();
  }

  const nextLabel = complete ? t('brands.devices.cornersDone') : t(CORNER_LABEL[points.length] as TranslationKey);

  return (
    <div data-testid="brand-corner-picker" className="space-y-2">
      <p data-testid="brand-corner-next" className="text-xs text-ink-muted">
        {nextLabel}
      </p>
      <div
        ref={surface}
        role="presentation"
        data-testid="brand-corner-surface"
        onClick={pick}
        className={`relative inline-block max-w-full overflow-hidden rounded-md border border-border-strong ${
          disabled || complete ? '' : 'cursor-crosshair'
        }`}
      >
        <img src={imageUrl} alt={imageAlt} draggable={false} className="block max-h-72 max-w-full select-none" />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {points.length >= 2 && (
            <polygon
              data-testid="brand-corner-polygon"
              points={points.map(([x, y]) => `${x},${y}`).join(' ')}
              fill={complete ? 'rgba(56,189,248,0.25)' : 'none'}
              stroke="rgb(56,189,248)"
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {points.map(([x, y], index) => (
          <span
            key={`${x}-${y}-${CORNER_LABEL[index]}`}
            data-testid={`brand-corner-point-${index}`}
            className="pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-sky-500 text-xs font-semibold text-white"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {index + 1}
          </span>
        ))}
      </div>
      {!disabled && (
        <div>
          <Button data-testid="brand-corner-reset" disabled={points.length === 0} onClick={reset}>
            {t('brands.devices.cornersReset')}
          </Button>
        </div>
      )}
    </div>
  );
}
