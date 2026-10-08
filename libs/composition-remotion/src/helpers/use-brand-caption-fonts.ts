import { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender } from 'remotion';
import type { CaptionTheme } from '@video-maker/timeline-core';

import { pathSrc } from './asset-src';

const FONT_LOAD_TIMEOUT_MS = 30_000;

export function brandFontFaces(theme: CaptionTheme): FontFace[] {
  return theme.fontFiles.map(
    (file) =>
      new FontFace(theme.fontFamily, `url("${pathSrc(file.path)}")`, {
        ...(file.weight === undefined ? {} : { weight: file.weight }),
        ...(file.unicodeRange === undefined ? {} : { unicodeRange: file.unicodeRange }),
      }),
  );
}

export function useBrandCaptionFonts(theme: CaptionTheme | undefined): void {
  const [handle] = useState(() =>
    theme === undefined ? null : delayRender('Loading brand caption fonts', { timeoutInMilliseconds: FONT_LOAD_TIMEOUT_MS }),
  );

  useEffect(() => {
    if (theme === undefined || handle === null) {
      return;
    }
    Promise.all(brandFontFaces(theme).map((face) => face.load()))
      .then((faces) => {
        faces.forEach((face) => document.fonts.add(face));
        continueRender(handle);
      })
      .catch((cause: unknown) => cancelRender(cause));
  }, [theme, handle]);
}
