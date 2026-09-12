import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CaptionStyleSelector } from './caption-style-selector';

function renderSelector(captionStyle?: 'bold-impact' | 'subtle-lower' | 'off') {
  const dispatch = vi.fn();

  render(
    <CaptionStyleSelector
      {...(captionStyle === undefined ? {} : { captionStyle })}
      dispatch={dispatch}
    />,
  );

  return dispatch;
}

function select(): HTMLSelectElement {
  return screen.getByLabelText('Caption style') as HTMLSelectElement;
}

describe('CaptionStyleSelector (FIX-006-001)', () => {
  it('ofrece las cinco etiquetas del producto, nunca el id del estilo', () => {
    renderSelector('bold-impact');

    expect([...select().options].map((option) => option.textContent)).toEqual([
      'Big and animated — reels and ads',
      'Big and plain — no uppercase',
      'Outlined — bright or busy backgrounds',
      'Subtitle at the bottom — tutorials and explainers',
      'No captions',
    ]);
  });

  it('muestra el estilo del documento', () => {
    renderSelector('subtle-lower');

    expect(select().value).toBe('subtle-lower');
  });

  it('un documento sin captionStyle muestra el estilo implícito y lo declara vacío', () => {
    renderSelector();

    expect(select().value).toBe('bold-impact');
    expect(screen.getByTestId('caption-style-selector').dataset['captionStyle']).toBe('');
  });

  it('elegir el subtítulo abajo despacha caption-style', () => {
    const dispatch = renderSelector('bold-impact');

    fireEvent.change(select(), { target: { value: 'subtle-lower' } });

    expect(dispatch).toHaveBeenCalledWith({ type: 'caption-style', captionStyle: 'subtle-lower' });
  });

  it('apagar los subtítulos despacha off', () => {
    const dispatch = renderSelector('subtle-lower');

    fireEvent.change(select(), { target: { value: 'off' } });

    expect(dispatch).toHaveBeenCalledWith({ type: 'caption-style', captionStyle: 'off' });
  });
});
