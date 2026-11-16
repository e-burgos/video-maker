import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OverflowMenu } from './overflow-menu';

function renderMenu(onSelect = vi.fn()) {
  render(
    <div>
      <button type="button">outside</button>
      <OverflowMenu
        triggerLabel="Options"
        triggerTestId="trigger"
        menuTestId="menu"
        items={[
          { id: 'a', label: 'First', testId: 'item-a', onSelect },
          { id: 'b', label: 'Remove', testId: 'item-b', tone: 'danger', onSelect: vi.fn() },
        ]}
      />
    </div>,
  );
  return onSelect;
}

describe('OverflowMenu', () => {
  it('stays closed until the trigger is pressed and exposes its state', () => {
    renderMenu();

    expect(screen.queryByTestId('menu')).toBeNull();
    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByTestId('menu')).toBeTruthy();
    expect(screen.getByTestId('trigger').getAttribute('aria-expanded')).toBe('true');
  });

  it('runs the chosen item and closes', () => {
    const onSelect = renderMenu();
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.click(screen.getByTestId('item-a'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('menu')).toBeNull();
  });

  it('closes on Escape and on a press outside', () => {
    renderMenu();
    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('menu')).toBeNull();

    fireEvent.click(screen.getByTestId('trigger'));
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByTestId('menu')).toBeNull();
  });
});
