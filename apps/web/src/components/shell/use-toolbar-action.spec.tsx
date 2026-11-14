import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ShellToolbar } from './shell-toolbar';
import { ToolbarActionProvider } from './toolbar-action-provider';
import { useToolbarAction } from './use-toolbar-action';
import type { ToolbarAction } from './toolbar-action-context';

function Page({ action }: { action: ToolbarAction | null }) {
  useToolbarAction(action);
  return null;
}

function Host({ action }: { action: ToolbarAction | null }) {
  const [mounted, setMounted] = useState(true);
  return (
    <ToolbarActionProvider>
      <ShellToolbar title="Title" subtitle={null} />
      {mounted && <Page action={action} />}
      <button type="button" onClick={() => setMounted(false)}>
        leave
      </button>
    </ToolbarActionProvider>
  );
}

describe('useToolbarAction', () => {
  it('shows only the title when the page declares no action', () => {
    render(<Host action={null} />);

    expect(screen.getByRole('heading', { name: 'Title' })).toBeTruthy();
    expect(screen.queryByTestId('toolbar-action')).toBeNull();
  });

  it('declares the action and runs the latest click handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Host action={{ label: 'Render', onClick: first }} />);

    rerender(<Host action={{ label: 'Render', onClick: second }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Render' }));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('follows label, disabled and loading changes', () => {
    const { rerender } = render(<Host action={{ label: 'Save', onClick: vi.fn() }} />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);

    rerender(<Host action={{ label: 'Saving', onClick: vi.fn(), loading: true }} />);
    const button = screen.getByRole('button', { name: 'Saving' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    rerender(<Host action={{ label: 'Save', onClick: vi.fn(), disabled: true }} />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears the action when the declaring page unmounts', () => {
    render(<Host action={{ label: 'Render', onClick: vi.fn() }} />);
    expect(screen.getByTestId('toolbar-action')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'leave' }));

    expect(screen.queryByTestId('toolbar-action')).toBeNull();
  });

  it('is a no-op outside the provider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <>{children}</>;
    const { unmount } = renderHook(() => useToolbarAction({ label: 'x', onClick: vi.fn() }), { wrapper });

    act(() => unmount());
  });
});
