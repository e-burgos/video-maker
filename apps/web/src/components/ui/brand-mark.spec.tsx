import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MESSAGES_ES } from '../../i18n/messages-es';
import { BrandMark, BrandWordmark } from './brand-mark';

describe('BrandMark', () => {
  it('renders the mark with the label it receives and the requested size', () => {
    render(<BrandMark label={MESSAGES_ES['brand.name']} size={40} />);

    const mark = screen.getByRole('img', { name: 'Video Maker' });
    expect(mark.getAttribute('width')).toBe('40');
    expect(mark.getAttribute('height')).toBe('40');
  });

  it('defaults the mark to 28 pixels', () => {
    render(<BrandMark label={MESSAGES_ES['brand.name']} />);

    expect(screen.getByRole('img', { name: 'Video Maker' }).getAttribute('width')).toBe('28');
  });
});

describe('BrandWordmark', () => {
  it('names the signature when its label includes it', () => {
    render(<BrandWordmark label={MESSAGES_ES['brand.nameWithSignature']} />);

    expect(screen.getByRole('img', { name: 'Video Maker by Esteban Burgos' })).toBeTruthy();
  });

  it('drops the signature outline when it is turned off', () => {
    const { container } = render(<BrandWordmark label={MESSAGES_ES['brand.name']} withSignature={false} />);
    const withSignature = render(<BrandWordmark label={MESSAGES_ES['brand.nameWithSignature']} />);

    expect(container.querySelectorAll('path').length).toBeLessThan(
      withSignature.container.querySelectorAll('path').length,
    );
  });

  it('keeps the wordmark aspect ratio when the height changes', () => {
    render(<BrandWordmark label={MESSAGES_ES['brand.nameWithSignature']} height={56} />);

    const wordmark = screen.getByRole('img', { name: 'Video Maker by Esteban Burgos' });
    const [, , viewWidth, viewHeight] = (wordmark.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(Number(wordmark.getAttribute('width'))).toBeCloseTo((viewWidth / viewHeight) * 56, 1);
  });
});
