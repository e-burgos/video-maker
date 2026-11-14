import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './modal';

function renderModal(onClose = vi.fn()) {
  render(
    <Modal title="Edit" testId="demo-modal" onClose={onClose} footer={<button type="button">Save</button>}>
      <p>Long content</p>
    </Modal>,
  );
  return onClose;
}

describe('Modal', () => {
  it('renders the glass dialog with title, content and footer', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Edit' });
    expect(dialog.className).toContain('glass-thick');
    expect(screen.getByText('Long content')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('scrolls only the body so the footer stays in view', () => {
    renderModal();

    expect(screen.getByTestId('demo-modal-body').className).toContain('overflow-y-auto');
    expect(screen.getByRole('dialog').className).not.toContain('overflow-y-auto');
  });

  it('closes with Escape, the close button and a backdrop click', () => {
    const onClose = renderModal();

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('demo-modal-close'));
    fireEvent.mouseDown(screen.getByTestId('demo-modal-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
