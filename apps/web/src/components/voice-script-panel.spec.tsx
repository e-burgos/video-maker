import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { VoiceScriptManifest } from '@video-maker/timeline-core';

import { VOICE_SCRIPT_MANIFEST } from '../api/__fixtures__/voice';
import { VoiceScriptPanel } from './voice-script-panel';

const MANIFEST = VOICE_SCRIPT_MANIFEST as unknown as VoiceScriptManifest;

describe('VoiceScriptPanel (FIX-009-003)', () => {
  it('lista una línea por frase del guion con su ventana de tiempo', () => {
    render(<VoiceScriptPanel slug="display-ads" manifest={MANIFEST} />);

    const lines = screen.getAllByTestId('voice-script-line');

    expect(lines).toHaveLength(2);
    expect(lines[0]?.textContent).toContain('0:00 to 0:04');
    expect(lines[1]?.textContent).toContain('0:22 to 0:27');
    expect(lines[1]?.textContent).toContain('El editor la ajusta en dos minutos.');
  });

  it('reproduce la pista de voz que el manifest declara', () => {
    render(<VoiceScriptPanel slug="display-ads" manifest={MANIFEST} />);

    expect(screen.getByTestId('voice-script-audio').getAttribute('src')).toBe(
      '/api/projects/display-ads/files/work/voice/voice.wav',
    );
  });

  it('nombra la voz que la generó y la duración de la pista', () => {
    render(<VoiceScriptPanel slug="display-ads" manifest={MANIFEST} />);

    expect(screen.getByText(/es_AR-daniela-high/u).textContent).toContain('63.5 s');
  });

  it('marca la línea que no entró en su ventana', () => {
    render(<VoiceScriptPanel slug="display-ads" manifest={MANIFEST} />);

    const overflow = screen.getAllByTestId('voice-script-overflow');

    expect(overflow).toHaveLength(1);
    expect(overflow[0]?.textContent).toContain('840');
  });

  it('informa cuántas líneas tiene el guion', () => {
    render(<VoiceScriptPanel slug="display-ads" manifest={MANIFEST} />);

    expect(screen.getByText(/2 lines/u)).toBeTruthy();
  });
});
