import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatDropZone } from './chat-drop-zone';

function file(name: string): File {
  return new File(['x'], name, { type: 'video/mp4' });
}

describe('ChatDropZone', () => {
  it('renders the hint and an attach button with no native file input visible', () => {
    render(<ChatDropZone onFiles={vi.fn()} />);

    expect(screen.getByTestId('chat-drop-zone').textContent).toContain('Drag your material here');
    const nativeInput = screen.getByLabelText('Attach files') as HTMLInputElement;
    expect(nativeInput.className).toContain('hidden');
  });

  it('opens the native file picker when the attach button is clicked', () => {
    render(<ChatDropZone onFiles={vi.fn()} />);

    const input = screen.getByLabelText('Attach files') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(screen.getByText('Attach files'));

    expect(clickSpy).toHaveBeenCalled();
  });

  it('reports the chosen files and resets the input so picking the same file again still fires', () => {
    const onFiles = vi.fn();
    render(<ChatDropZone onFiles={onFiles} />);

    const input = screen.getByLabelText('Attach files') as HTMLInputElement;
    const chosen = [file('clip01.mp4')];
    Object.defineProperty(input, 'files', { value: chosen, configurable: true });
    fireEvent.change(input);

    expect(onFiles).toHaveBeenCalledWith(chosen);
    expect(input.value).toBe('');
  });

  it('disables the attach button while uploads are in flight', () => {
    render(<ChatDropZone onFiles={vi.fn()} disabled />);

    expect((screen.getByText('Attach files') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Attach files') as HTMLInputElement).disabled).toBe(true);
  });
});
