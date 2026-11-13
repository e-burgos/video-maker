import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSectionDraft } from './use-section-draft';

describe('useSectionDraft', () => {
  it('starts clean and turns dirty when the draft differs from what is saved', () => {
    const { result } = renderHook(() => useSectionDraft({ name: 'a' }));

    expect(result.current.dirty).toBe(false);
    act(() => result.current.setDraft({ name: 'b' }));

    expect(result.current.dirty).toBe(true);
    expect(result.current.draft).toEqual({ name: 'b' });
  });

  it('adopts a new saved value in the same render, with no dirty flash', () => {
    const { result, rerender } = renderHook(({ saved }) => useSectionDraft(saved), {
      initialProps: { saved: { name: '' } },
    });

    rerender({ saved: { name: 'loaded' } });

    expect(result.current.draft).toEqual({ name: 'loaded' });
    expect(result.current.dirty).toBe(false);
  });

  it('keeps a pending draft while the saved value does not change', () => {
    const { result, rerender } = renderHook(({ saved }) => useSectionDraft(saved), {
      initialProps: { saved: { name: 'a' } },
    });
    act(() => result.current.setDraft((current) => ({ ...current, name: 'edit' })));

    rerender({ saved: { name: 'a' } });

    expect(result.current.draft).toEqual({ name: 'edit' });
  });
});
