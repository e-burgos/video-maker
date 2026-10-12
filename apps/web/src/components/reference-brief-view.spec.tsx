import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { referenceBrief } from '../api/__fixtures__/reference';
import { ReferenceBriefView } from './reference-brief-view';

describe('ReferenceBriefView', () => {
  it('shows the summary, format, duration, pace, voice and audio', () => {
    render(<ReferenceBriefView slug="demo-01" brief={referenceBrief()} />);

    expect(screen.getByTestId('reference-summary').textContent).toBe('2 escenas, 14.2 cortes por minuto.');
    expect(screen.getByTestId('reference-format').textContent).toBe('1080×1920 · 30 fps · portrait');
    expect(screen.getByTestId('reference-duration').textContent).toBe('42.3 s');
    expect(screen.getByTestId('reference-cuts-per-minute').textContent).toBe('14.2');
    expect(screen.getByTestId('reference-mean-scene').textContent).toBe('4.9 s');
    expect(screen.getByTestId('reference-median-scene').textContent).toBe('4.4 s');
    expect(screen.getByTestId('reference-wpm').textContent).toBe('148');
    expect(screen.getByTestId('reference-speech-ratio').textContent).toBe('72%');
    expect(screen.getByTestId('reference-lufs').textContent).toBe('-15.4 LUFS');
    expect(screen.getByTestId('reference-silences').textContent).toBe('0:20–0:22');
  });

  it('lists the transcript phrases with their times inside a collapsible block', () => {
    render(<ReferenceBriefView slug="demo-01" brief={referenceBrief()} />);

    const transcript = within(screen.getByTestId('reference-transcript'));
    expect(transcript.getByText('Transcript (2 phrases)')).toBeTruthy();
    expect(transcript.getByText('Hola, hoy te muestro algo.')).toBeTruthy();
    expect(transcript.getByText('1:05')).toBeTruthy();
    expect(screen.getByTestId('reference-transcript').hasAttribute('open')).toBe(false);
  });

  it('says there is no voice when the reference has none', () => {
    render(<ReferenceBriefView slug="demo-01" brief={referenceBrief({ voice: null })} />);

    expect(screen.getByTestId('reference-no-voice').textContent).toBe('No spoken voice detected.');
    expect(screen.queryByTestId('reference-transcript')).toBeNull();
  });

  it('reports unmeasured loudness and no long silences', () => {
    render(
      <ReferenceBriefView
        slug="demo-01"
        brief={referenceBrief({ audio: { integratedLufs: null, longSilences: [] } })}
      />,
    );

    expect(screen.getByTestId('reference-lufs').textContent).toBe('Not measured');
    expect(screen.getByTestId('reference-silences').textContent).toBe('None');
  });
});
