import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoicePicker, voiceQualityKey } from './voice-picker';
import type { VoiceModel } from '../api/render-api-types';

const DANIELA: VoiceModel = {
  id: 'es_AR-daniela-high',
  fileName: 'es_AR-daniela-high.onnx',
  isDefault: true,
  language: { code: 'es-AR', region: 'AR' },
  quality: 'high',
  label: 'Daniela · Spanish (Argentina) · High quality',
  description: 'Neural voice trained on the "daniela" dataset. Spanish as spoken in Argentina.',
  previewUrl: '/voices/es_AR-daniela-high/preview',
};

const DAVEFX: VoiceModel = {
  id: 'es_ES-davefx-medium',
  fileName: 'es_ES-davefx-medium.onnx',
  isDefault: false,
  language: { code: 'es-ES', region: 'ES' },
  quality: 'medium',
  label: 'Davefx · Spanish (Spain) · Medium quality',
  description: 'Neural voice trained on the "davefx" dataset. Spanish as spoken in Spain.',
  previewUrl: '/voices/es_ES-davefx-medium/preview',
};

const VOICES = [DANIELA, DAVEFX];

function audioOf(voiceId: string): HTMLAudioElement {
  const audio = document
    .querySelectorAll<HTMLAudioElement>('[data-testid="voice-preview-audio"]')
    .values()
    .find((candidate) => candidate.dataset['voiceId'] === voiceId);
  if (audio === undefined) {
    throw new Error(`no preview audio for ${voiceId}`);
  }
  return audio;
}

function cardOf(voiceId: string): HTMLElement {
  const card = screen
    .getAllByTestId('voice-card')
    .find((candidate) => candidate.dataset['voiceId'] === voiceId);
  if (card === undefined) {
    throw new Error(`no card for ${voiceId}`);
  }
  return card;
}

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;

beforeEach(() => {
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  HTMLMediaElement.prototype.play = play as unknown as HTMLMediaElement['play'];
  HTMLMediaElement.prototype.pause = pause as unknown as HTMLMediaElement['pause'];
});

afterEach(cleanup);

describe('VoicePicker (US-016-003)', () => {
  it('renders one card per installed voice with its label, language, quality and description', () => {
    render(<VoicePicker voices={VOICES} selectedId={DANIELA.id} onSelect={() => undefined} />);

    expect(screen.getAllByTestId('voice-card')).toHaveLength(2);
    expect(cardOf(DANIELA.id).textContent).toContain('Daniela · Spanish (Argentina) · High quality');
    expect(cardOf(DANIELA.id).textContent).toContain('es-AR · high quality · default');
    expect(cardOf(DAVEFX.id).textContent).toContain('es-ES · medium quality');
    expect(cardOf(DAVEFX.id).textContent).toContain('trained on the "davefx" dataset');
  });

  it('marks the selected voice and reports the one the user picks', () => {
    const onSelect = vi.fn();
    render(<VoicePicker voices={VOICES} selectedId={DANIELA.id} onSelect={onSelect} />);

    expect(cardOf(DANIELA.id).dataset['selected']).toBe('true');
    expect(cardOf(DAVEFX.id).dataset['selected']).toBe('false');

    fireEvent.click(screen.getByLabelText(`Use ${DAVEFX.label}`));

    expect(onSelect).toHaveBeenCalledWith(DAVEFX.id);
  });

  it('points every preview at the endpoint of that voice through the service proxy', () => {
    render(<VoicePicker voices={VOICES} selectedId={null} onSelect={() => undefined} />);

    expect(audioOf(DANIELA.id).getAttribute('src')).toBe('/api/voices/es_AR-daniela-high/preview');
    expect(audioOf(DAVEFX.id).getAttribute('src')).toBe('/api/voices/es_ES-davefx-medium/preview');
  });

  it('plays the preview of the voice whose button is clicked and shows it is loading first', async () => {
    render(<VoicePicker voices={VOICES} selectedId={null} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText(`Preview ${DANIELA.label}`));
    expect(cardOf(DANIELA.id).dataset['previewState']).toBe('loading');
    expect(play).toHaveBeenCalledTimes(1);

    fireEvent.playing(audioOf(DANIELA.id));
    expect(cardOf(DANIELA.id).dataset['previewState']).toBe('playing');
  });

  it('stops the voice that was playing when another one starts', () => {
    render(<VoicePicker voices={VOICES} selectedId={null} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText(`Preview ${DANIELA.label}`));
    fireEvent.playing(audioOf(DANIELA.id));
    fireEvent.click(screen.getByLabelText(`Preview ${DAVEFX.label}`));

    expect(cardOf(DANIELA.id).dataset['previewState']).toBe('idle');
    expect(pause).toHaveBeenCalled();
  });

  it('a second click on the same voice stops it instead of starting it twice', () => {
    render(<VoicePicker voices={VOICES} selectedId={null} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText(`Preview ${DANIELA.label}`));
    fireEvent.playing(audioOf(DANIELA.id));
    fireEvent.click(screen.getByLabelText(`Preview ${DANIELA.label}`));

    expect(play).toHaveBeenCalledTimes(1);
    expect(cardOf(DANIELA.id).dataset['previewState']).toBe('idle');
  });

  it('goes back to idle when the demo reaches its end', () => {
    render(<VoicePicker voices={VOICES} selectedId={null} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText(`Preview ${DANIELA.label}`));
    fireEvent.playing(audioOf(DANIELA.id));
    fireEvent.ended(audioOf(DANIELA.id));

    expect(cardOf(DANIELA.id).dataset['previewState']).toBe('idle');
  });

  it('explains a preview that the service could not synthesize instead of failing silently', () => {
    render(<VoicePicker voices={VOICES} selectedId={null} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText(`Preview ${DANIELA.label}`));
    fireEvent.error(audioOf(DANIELA.id));

    expect(cardOf(DANIELA.id).dataset['previewState']).toBe('error');
    expect(screen.getByTestId('voice-preview-error').textContent).toContain('Piper is installed');
  });

  it('a play() the browser rejects leaves the card in error, never stuck on loading', async () => {
    play.mockRejectedValueOnce(new Error('NotAllowedError'));
    render(<VoicePicker voices={VOICES} selectedId={null} onSelect={() => undefined} />);

    fireEvent.click(screen.getByLabelText(`Preview ${DANIELA.label}`));

    await waitFor(() => expect(cardOf(DANIELA.id).dataset['previewState']).toBe('error'));
  });

  it('omits the quality when the model does not declare one instead of inventing it', () => {
    const unknown: VoiceModel = { ...DAVEFX, id: 'custom', quality: null, label: 'Custom · custom' };
    render(<VoicePicker voices={[unknown]} selectedId={null} onSelect={() => undefined} />);

    expect(voiceQualityKey(null)).toBeNull();
    expect(cardOf('custom').textContent).not.toContain('quality');
  });

  it('disables picking a voice while a job is being created, but still lets it be heard', () => {
    render(<VoicePicker voices={VOICES} selectedId={DANIELA.id} onSelect={() => undefined} disabled />);

    expect((screen.getByLabelText(`Use ${DAVEFX.label}`) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText(`Preview ${DAVEFX.label}`) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
