import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LogoBumper } from '@video-maker/timeline-core';

import { LogoBumperEditor } from './logo-bumper-editor';

const INTRO: LogoBumper = {
  enabled: true,
  durationMs: 2000,
  backgroundColor: '#ffffff',
  animation: 'zoom',
  logoWidthRatio: 0.4,
};

function renderEditor(options: {
  bumpers?: { intro?: LogoBumper; outro?: LogoBumper; style?: { rotate: boolean } };
  logoAvailable?: boolean;
}) {
  const dispatch = vi.fn();
  render(
    <LogoBumperEditor
      {...(options.bumpers === undefined ? {} : { bumpers: options.bumpers })}
      logoAvailable={options.logoAvailable ?? true}
      dispatch={dispatch}
    />,
  );
  return dispatch;
}

function introCheckbox(): HTMLInputElement {
  return screen.getByLabelText('Add a video intro') as HTMLInputElement;
}

describe('LogoBumperEditor', () => {
  it('muestra las dos tildes, apagadas cuando la Timeline no tiene bumpers', () => {
    renderEditor({});

    expect(introCheckbox().checked).toBe(false);
    expect((screen.getByLabelText('Add a video outro') as HTMLInputElement).checked).toBe(false);
  });

  it('sin logo las tildes quedan deshabilitadas con la ayuda a la vista', () => {
    renderEditor({ logoAvailable: false });

    expect(introCheckbox().disabled).toBe(true);
    expect(screen.getByTestId('bumper-needs-logo').textContent).toBe(
      'Upload a logo to use the intro and the outro',
    );
  });

  it('tildar el inicio despacha bumper-enabled', () => {
    const dispatch = renderEditor({});

    fireEvent.click(introCheckbox());

    expect(dispatch).toHaveBeenCalledWith({ type: 'bumper-enabled', edge: 'intro', enabled: true });
  });

  it('sin tildar no despliega los ajustes', () => {
    renderEditor({});

    expect(screen.queryByTestId('bumper-settings-intro')).toBeNull();
  });

  it('con el inicio tildado muestra sus ajustes con los valores del documento', () => {
    renderEditor({ bumpers: { intro: INTRO } });

    expect(screen.getByTestId('bumper-settings-intro')).toBeTruthy();
    expect((screen.getByLabelText('Intro background colour') as HTMLInputElement).value).toBe('#ffffff');
    expect((screen.getByLabelText('Intro duration') as HTMLSelectElement).value).toBe('2000');
    expect((screen.getByLabelText('Intro animation') as HTMLSelectElement).value).toBe('zoom');
    expect((screen.getByLabelText('Intro logo size') as HTMLSelectElement).value).toBe('medium');
    expect(screen.queryByTestId('bumper-settings-outro')).toBeNull();
  });

  it('el picker de color despacha el hex elegido', () => {
    const dispatch = renderEditor({ bumpers: { intro: INTRO } });

    fireEvent.change(screen.getByLabelText('Intro background colour'), {
      target: { value: '#0b1020' },
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'bumper-style',
      edge: 'intro',
      style: { backgroundColor: '#0b1020' },
    });
  });

  it('el hex editable ignora lo que todavía no es un color válido', () => {
    const dispatch = renderEditor({ bumpers: { intro: INTRO } });
    const hex = screen.getByLabelText('Intro background hex');

    fireEvent.change(hex, { target: { value: '#0b10' } });
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.change(hex, { target: { value: '#0b1020' } });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'bumper-style',
      edge: 'intro',
      style: { backgroundColor: '#0b1020' },
    });
  });

  it('la duración ofrece 1,5 / 2 / 3 / 4 s y despacha milisegundos', () => {
    const dispatch = renderEditor({ bumpers: { intro: INTRO } });
    const select = screen.getByLabelText('Intro duration') as HTMLSelectElement;

    expect([...select.options].map((option) => option.textContent)).toEqual([
      '1.5 s',
      '2.0 s',
      '3.0 s',
      '4.0 s',
    ]);

    fireEvent.change(select, { target: { value: '3000' } });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'bumper-style',
      edge: 'intro',
      style: { durationMs: 3000 },
    });
  });

  it('la animación ofrece los revelados y el tamaño del logo mapea a su ratio', () => {
    const dispatch = renderEditor({ bumpers: { outro: { ...INTRO, logoWidthRatio: 0.55 } } });

    expect((screen.getByLabelText('Outro logo size') as HTMLSelectElement).value).toBe('large');

    fireEvent.change(screen.getByLabelText('Outro animation'), { target: { value: 'slide-up' } });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'bumper-style',
      edge: 'outro',
      style: { reveal: 'slide-up', animation: 'slide-up' },
    });

    fireEvent.change(screen.getByLabelText('Outro logo size'), { target: { value: 'small' } });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'bumper-style',
      edge: 'outro',
      style: { logoWidthRatio: 0.3 },
    });
  });

  it('sin rotación no ofrece automático: el fondo arranca liso y el revelado es el de animation', () => {
    renderEditor({ bumpers: { intro: INTRO } });

    expect((screen.getByLabelText('Intro animated background') as HTMLSelectElement).value).toBe('solid');
    expect(screen.queryAllByRole('option', { name: 'automatic (changes per video)' })).toHaveLength(0);
  });

  it('con rotación muestra automático y elegir un fondo o volver a automático despacha el estilo', () => {
    const dispatch = renderEditor({ bumpers: { intro: INTRO, style: { rotate: true } } });

    expect((screen.getByLabelText('Intro animated background') as HTMLSelectElement).value).toBe('auto');
    expect((screen.getByLabelText('Intro animation') as HTMLSelectElement).value).toBe('auto');

    fireEvent.change(screen.getByLabelText('Intro animated background'), { target: { value: 'noise' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'bumper-style', edge: 'intro', style: { background: 'noise' } });

    fireEvent.change(screen.getByLabelText('Intro animation'), { target: { value: 'pop' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'bumper-style', edge: 'intro', style: { reveal: 'pop' } });
  });

  it('el texto debajo del logo se despacha y vacío se borra', () => {
    const dispatch = renderEditor({ bumpers: { intro: { ...INTRO, caption: 'acme.test' } } });

    fireEvent.change(screen.getByLabelText('Text under the intro logo'), { target: { value: 'otra.web' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'bumper-style', edge: 'intro', style: { caption: 'otra.web' } });

    fireEvent.change(screen.getByLabelText('Text under the intro logo'), { target: { value: '   ' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'bumper-style', edge: 'intro', style: { caption: undefined } });
  });
});
