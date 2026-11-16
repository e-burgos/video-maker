import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RequirementRow } from './requirement-row';
import type { RequirementItem } from './requirements-model';

const COPY = { label: 'Local media', purpose: 'Reads media.', fix: 'Install the toolchain.' };

function renderRow(state: RequirementItem['state']) {
  const item = { id: 'media-local', group: 'engine', state, envVar: null } as RequirementItem;
  return render(
    <ul>
      <RequirementRow item={item} copy={COPY} />
    </ul>,
  );
}

describe('RequirementRow', () => {
  it('hides how to fix it when the requirement is met', () => {
    renderRow('ok');

    expect(screen.queryByText('Install the toolchain.')).toBeNull();
    expect(screen.queryByTestId('about-requirement-fix')).toBeNull();
  });

  it.each(['missing', 'optional'] as const)('shows how to fix it when the requirement is %s', (state) => {
    renderRow(state);

    expect(screen.getByTestId('about-requirement-fix').textContent).toContain('Install the toolchain.');
  });
});
