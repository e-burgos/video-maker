import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProducerScriptPanel } from './producer-script-panel';

const SCRIPT = '[0:00] Cada anuncio arranca de una plantilla.\n[0:22] El editor la ajusta en dos minutos.';

describe('ProducerScriptPanel (FIX-009-003)', () => {
  it('muestra el guion tal cual, con sus marcas de tiempo', () => {
    render(<ProducerScriptPanel script={SCRIPT} />);

    expect(screen.getByTestId('producer-script-text').textContent).toBe(SCRIPT);
  });

  it('lo titula como el guion del productor y explica por qué está ahí', () => {
    render(<ProducerScriptPanel script={SCRIPT} />);

    expect(screen.getByText('Producer script')).toBeTruthy();
    expect(screen.getByText(/no storyboard/u)).toBeTruthy();
  });
});
