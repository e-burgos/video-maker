import { useEffect, useState } from 'react';

import { brandFileUrl } from '../api/brand-files';
import type { BrandFont } from '../api/brand-types';

export function brandFontFamilyName(brandId: string, family: string): string {
  return `brand-preview-${brandId}-${family}`;
}

export function useBrandFontFaces(brandId: string, fonts: readonly BrandFont[]): ReadonlySet<string> {
  const [ready, setReady] = useState<ReadonlySet<string>>(new Set());
  const signature = JSON.stringify(fonts.map((font) => [font.family, font.file, font.weight ?? null, font.unicodeRange ?? null]));

  useEffect(() => {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !('fonts' in document)) {
      return;
    }
    let current = true;
    for (const font of fonts) {
      const family = brandFontFamilyName(brandId, font.family);
      const face = new FontFace(family, `url("${brandFileUrl(brandId, font.file)}")`, {
        weight: font.weight ?? '100 900',
        ...(font.unicodeRange === undefined ? {} : { unicodeRange: font.unicodeRange }),
      });
      face
        .load()
        .then((loaded) => {
          document.fonts.add(loaded);
          if (current) {
            setReady((previous) => new Set([...previous, font.family]));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      current = false;
    };
  }, [brandId, signature]);

  return ready;
}
