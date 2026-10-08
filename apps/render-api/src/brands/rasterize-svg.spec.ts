import { describe, expect, it } from 'vitest';

import { brandLogoRasterSize } from './rasterize-svg';

describe('brandLogoRasterSize', () => {
  it('keeps the viewBox aspect at 1600 px wide', () => {
    expect(brandLogoRasterSize('<svg xmlns="x" viewBox="158 13 3540 1121"><path/></svg>')).toEqual({ widthPx: 1600, heightPx: 507 });
  });

  it('falls back to width and height attributes when there is no viewBox', () => {
    expect(brandLogoRasterSize('<svg width="400px" height="100"></svg>')).toEqual({ widthPx: 1600, heightPx: 400 });
  });

  it('answers a square when the SVG declares no usable size', () => {
    expect(brandLogoRasterSize('<svg width="100%" height="50%"></svg>')).toEqual({ widthPx: 1600, heightPx: 1600 });
    expect(brandLogoRasterSize('not svg')).toEqual({ widthPx: 1600, heightPx: 1600 });
  });

  it('caps absurdly tall logos', () => {
    expect(brandLogoRasterSize('<svg viewBox="0 0 10 1000"></svg>').heightPx).toBe(4000);
  });
});
