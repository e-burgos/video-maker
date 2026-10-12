import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { VoiceDirection } from '@video-maker/timeline-core';

import { VoiceDirectionEditor } from './voice-direction-editor';

function Harness({ initial, onChange }: { initial?: VoiceDirection; onChange: (next: VoiceDirection | undefined) => void }) {
  const [direction, setDirection] = useState<VoiceDirection | undefined>(initial);
  return (
    <VoiceDirectionEditor
      target="line 2"
      text="El editor la ajusta en dos minutos."
      direction={direction}
      onChange={(next) => {
        setDirection(next);
        onChange(next);
      }}
    />
  );
}

describe('VoiceDirectionEditor', () => {
  it('shows the voice defaults when there is no direction', () => {
    render(<Harness onChange={vi.fn()} />);

    expect((screen.getByRole('combobox', { name: 'Pace of line 2' }) as HTMLSelectElement).value).toBe('normal');
    expect((screen.getByRole('combobox', { name: 'Energy of line 2' }) as HTMLSelectElement).value).toBe('neutral');
    expect((screen.getByRole('spinbutton', { name: 'Pause after line 2 (ms)' }) as HTMLInputElement).value).toBe('0');
    expect(screen.queryByRole('button', { name: 'Clear direction of line 2' })).toBeNull();
  });

  it('emits the pace, the energy and the pause the dev picks', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Pace of line 2' }), { target: { value: 'slow' } });
    expect(onChange).toHaveBeenLastCalledWith({ pace: 'slow' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Energy of line 2' }), { target: { value: 'lively' } });
    expect(onChange).toHaveBeenLastCalledWith({ pace: 'slow', energy: 'lively' });

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Pause after line 2 (ms)' }), { target: { value: '600' } });
    expect(onChange).toHaveBeenLastCalledWith({ pace: 'slow', energy: 'lively', pauseAfterMs: 600 });
  });

  it('only offers words of the line to stress, and toggles them', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(screen.queryByRole('button', { name: 'plantilla' })).toBeNull();
    const editor = screen.getByRole('button', { name: 'editor' });
    expect(editor.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(editor);
    expect(onChange).toHaveBeenLastCalledWith({ emphasis: ['editor'] });
    expect(screen.getByRole('button', { name: 'editor' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'editor' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('clears the whole direction of the line', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ pace: 'fast', emphasis: ['editor'] }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear direction of line 2' }));

    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect((screen.getByRole('combobox', { name: 'Pace of line 2' }) as HTMLSelectElement).value).toBe('normal');
  });
});
