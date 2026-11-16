import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState, LoadingState } from './status-states';

describe('LoadingState', () => {
  it('announces the message as a status', () => {
    render(<LoadingState message="Loading videos" />);

    expect(screen.getByRole('status').textContent).toBe('Loading videos');
  });
});

describe('EmptyState', () => {
  it('shows the message alone', () => {
    render(<EmptyState message="Nothing here" />);

    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the title and the extra content above and below the message', () => {
    render(
      <EmptyState title="No brands" message="Create the first one">
        <button type="button">Create</button>
      </EmptyState>,
    );

    expect(screen.getByText('No brands')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });
});
