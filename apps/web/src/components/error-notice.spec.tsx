import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorNotice } from './error-notice';
import { RenderApiError } from '../api/render-api-error';

describe('ErrorNotice', () => {
  it('shows the service code and message', () => {
    render(
      <ErrorNotice
        error={new RenderApiError('ASSET_ALREADY_EXISTS', 'The asset already exists.', 409, null)}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('ASSET_ALREADY_EXISTS');
    expect(screen.getByRole('alert').textContent).toContain('The asset already exists.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lists the detail fields the payload carries and retries on demand', () => {
    const onRetry = vi.fn();
    render(
      <ErrorNotice
        error={
          new RenderApiError('ASSET_PATH_INVALID', 'Bad path.', 422, {
            code: 'ASSET_PATH_INVALID',
            stage: null,
            message: 'Bad path.',
            resource: 'raw/aroll/x.mp4',
            expected: 'a portable path',
          })
        }
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('resource: raw/aroll/x.mp4')).toBeTruthy();
    expect(screen.getByText('expected: a portable path')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
