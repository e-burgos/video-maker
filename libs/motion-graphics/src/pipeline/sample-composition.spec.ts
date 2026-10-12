import { describe, expect, it } from 'vitest';

import { MotionStudioError } from '../errors/motion-studio-error';
import { truncateCompositionDuration } from './sample-composition';

const HTML =
  '<body><div id="root" class="fmt-16x9" data-composition-id="motion" data-start="0" data-width="1920" data-height="1080" data-duration="84.319">' +
  '<section data-start="0" data-duration="6.123"></section><section data-start="6.1" data-duration="7.868"></section></div></body>';

describe('truncateCompositionDuration', () => {
  it('cuts only the root data-duration and leaves every scene as it was', () => {
    const cut = truncateCompositionDuration(HTML, 10);

    expect(cut).toContain('data-composition-id="motion" data-start="0" data-width="1920" data-height="1080" data-duration="10"');
    expect(cut).toContain('data-duration="6.123"');
    expect(cut).toContain('data-duration="7.868"');
    expect(cut.replace('data-duration="10"', 'data-duration="84.319"')).toBe(HTML);
  });

  it('keeps the composition as it is when the video is not longer than the sample', () => {
    expect(truncateCompositionDuration(HTML, 84.319)).toBe(HTML);
    expect(truncateCompositionDuration(HTML, 120)).toBe(HTML);
  });

  it.each([
    ['no motion root', '<div id="root" data-duration="10"></div>'],
    ['a root without duration', '<div data-composition-id="motion" data-start="0"></div>'],
  ])('fails with STAGE_FAILED for %s', (_label, html) => {
    expect(() => truncateCompositionDuration(html, 10)).toThrow(MotionStudioError);
  });
});
