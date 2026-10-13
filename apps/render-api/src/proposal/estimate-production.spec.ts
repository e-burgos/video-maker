import type { ProposalConcept } from '@video-maker/timeline-core';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRODUCER_TOKENS_BASE,
  MIN_HISTORY_SAMPLES,
  DEFAULT_PRODUCER_TOKENS_PER_SCENE,
  DEFAULT_RENDER_PROCESS_SEC_PER_VIDEO_SEC,
  DEFAULT_VOICE_PROCESS_SEC_PER_AUDIO_SEC,
  HISTORY_WINDOW,
  estimateProduction,
} from './estimate-production';
import type { HistorySample, ProducerEngineForEstimate } from './estimate-production';

const CLAUDE: ProducerEngineForEstimate = { kind: 'claude-cli' };

function concept(overrides: Partial<ProposalConcept> = {}): ProposalConcept {
  return {
    id: 'directo',
    title: 'Directo',
    angle: 'Paso a paso',
    format: 'youtube-16x9',
    durationSec: 120,
    scenes: 10,
    delivery: { kind: 'tutorial', requiresVoice: true },
    ...overrides,
  };
}

function render(processPerMedia: number, format: string | null, finishedAt: string, mode: 'footage' | 'motion' = 'footage'): HistorySample {
  return { kind: 'render', mode, format, mediaSec: 100, processSec: 100 * processPerMedia, finishedAt };
}

function voice(processPerMedia: number, finishedAt: string): HistorySample {
  return { kind: 'voice', mode: null, format: null, mediaSec: 50, processSec: 50 * processPerMedia, finishedAt };
}

describe('estimateProduction rates', () => {
  it('falls back to the declared constants without history', () => {
    const estimate = estimateProduction(concept(), [], CLAUDE);

    expect(estimate.basis.render).toEqual({ source: 'default', samples: 0, processSecPerMediaSec: DEFAULT_RENDER_PROCESS_SEC_PER_VIDEO_SEC.footage, rough: true });
    expect(estimate.basis.voice).toEqual({ source: 'default', samples: 0, processSecPerMediaSec: DEFAULT_VOICE_PROCESS_SEC_PER_AUDIO_SEC, rough: true });
    expect(estimate.renderMinutes).toBe(4);
    expect(estimate.voiceMinutes).toBe(1.5);
  });

  it('uses the median of the same format when it has at least three samples', () => {
    const history = [
      render(1, 'youtube-16x9', '2026-10-01T00:00:00Z'),
      render(3, 'youtube-16x9', '2026-10-02T00:00:00Z'),
      render(2, 'youtube-16x9', '2026-10-03T00:00:00Z'),
      render(9, 'reels-9x16', '2026-10-04T00:00:00Z'),
    ];

    const estimate = estimateProduction(concept(), history, CLAUDE);

    expect(estimate.basis.render).toEqual({ source: 'history-format', samples: 3, processSecPerMediaSec: 2, rough: false });
    expect(estimate.renderMinutes).toBe(4);
  });

  it('uses the mode median, not rough, when the format has fewer than three samples but the mode has three', () => {
    const history = [
      render(2, 'youtube-16x9', '2026-10-01T00:00:00Z'),
      render(4, 'reels-9x16', '2026-10-02T00:00:00Z'),
      render(6, 'reels-9x16', '2026-10-03T00:00:00Z'),
    ];

    const estimate = estimateProduction(concept(), history, CLAUDE);

    expect(estimate.basis.render).toEqual({ source: 'history-mode', samples: 3, processSecPerMediaSec: 4, rough: false });
  });

  it.each([1, 2])('falls back to the studio median, flagged rough, with %i sample(s) of the mode', (count) => {
    const footage = Array.from({ length: count }, (_, index) => render(2, 'youtube-16x9', `2026-10-0${index + 1}T00:00:00Z`));
    const history = [...footage, render(8, null, '2026-10-05T00:00:00Z', 'motion'), render(14, null, '2026-10-06T00:00:00Z', 'motion')];

    const estimate = estimateProduction(concept(), history, CLAUDE);

    expect(estimate.basis.render.source).toBe('history-studio');
    expect(estimate.basis.render.samples).toBe(count + 2);
    expect(estimate.basis.render.rough).toBe(true);
  });

  it('uses motion samples of the studio for a footage concept that has none of its own', () => {
    const estimate = estimateProduction(concept(), [render(5, null, '2026-10-01T00:00:00Z', 'motion')], CLAUDE);

    expect(estimate.basis.render).toEqual({ source: 'history-studio', samples: 1, processSecPerMediaSec: 5, rough: true });
  });

  it('keeps the same payload keys for every source', () => {
    const sources = [
      estimateProduction(concept(), [], CLAUDE),
      estimateProduction(concept(), [render(2, null, '2026-10-01T00:00:00Z', 'motion')], CLAUDE),
      estimateProduction(concept(), Array.from({ length: MIN_HISTORY_SAMPLES }, () => render(2, 'youtube-16x9', '2026-10-01T00:00:00Z')), CLAUDE),
    ];

    for (const estimate of sources) {
      expect(Object.keys(estimate.basis.render).sort()).toEqual(['processSecPerMediaSec', 'rough', 'samples', 'source']);
    }
  });

  it('keeps only the newest samples inside the window', () => {
    const old = Array.from({ length: HISTORY_WINDOW }, (_, index) => render(10, 'youtube-16x9', `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00Z`));
    const recent = Array.from({ length: HISTORY_WINDOW }, () => render(2, 'youtube-16x9', '2026-10-10T00:00:00Z'));

    const estimate = estimateProduction(concept(), [...old, ...recent], CLAUDE);

    expect(estimate.basis.render).toMatchObject({ samples: HISTORY_WINDOW, processSecPerMediaSec: 2 });
  });

  it('ignores motion history for a footage concept and the other way around', () => {
    const history = [
      render(8, null, '2026-10-01T00:00:00Z', 'motion'),
      render(2, 'youtube-16x9', '2026-10-02T00:00:00Z'),
      render(2, 'youtube-16x9', '2026-10-03T00:00:00Z'),
      render(2, 'youtube-16x9', '2026-10-04T00:00:00Z'),
    ];

    expect(estimateProduction(concept(), history, CLAUDE).basis.render.processSecPerMediaSec).toBe(2);
    const motion = estimateProduction(concept({ delivery: { kind: 'motion' } }), history, CLAUDE);
    expect(motion.basis.render).toMatchObject({ source: 'history-studio', samples: 4, rough: true });
  });
});

describe('estimateProduction voice', () => {
  it('has no voice time for motion, whose job already includes the synthesis', () => {
    const estimate = estimateProduction(concept({ delivery: { kind: 'motion' } }), [voice(1, '2026-10-01T00:00:00Z')], CLAUDE);

    expect(estimate.voiceMinutes).toBe(0);
    expect(estimate.basis.voice).toBeNull();
    expect(estimate.renderMinutes).toBe(16);
  });

  it('has no voice time when the delivery needs no voice', () => {
    expect(estimateProduction(concept({ delivery: { kind: 'tutorial', requiresVoice: false } }), [], CLAUDE).voiceMinutes).toBe(0);
  });

  it('prices the voice with the history of voice jobs', () => {
    const estimate = estimateProduction(concept({ durationSec: 100 }), [voice(0.6, '2026-10-01T00:00:00Z')], CLAUDE);

    expect(estimate.basis.voice).toMatchObject({ source: 'history-studio', processSecPerMediaSec: 0.6, rough: true });
    expect(estimate.voiceMinutes).toBe(0.9);
  });
});

describe('estimateProduction producer cost', () => {
  const OPENROUTER: ProducerEngineForEstimate = {
    kind: 'openrouter',
    model: 'deepseek/deepseek-v4.1-flash',
    pricing: { promptPerMTokUsd: 0.15, completionPerMTokUsd: 0.6 },
  };

  it.each([['claude-cli', CLAUDE], ['none', { kind: 'none' } as ProducerEngineForEstimate]])('has neither tokens nor USD with %s', (_label, engine) => {
    const estimate = estimateProduction(concept(), [], engine);

    expect(estimate.producerTokens).toBeNull();
    expect(estimate.usd).toBeNull();
  });

  it('estimates tokens from the scenes and prices them with the model rates', () => {
    const estimate = estimateProduction(concept({ scenes: 10 }), [], OPENROUTER);

    const input = DEFAULT_PRODUCER_TOKENS_BASE.input + 10 * DEFAULT_PRODUCER_TOKENS_PER_SCENE.input;
    const output = DEFAULT_PRODUCER_TOKENS_BASE.output + 10 * DEFAULT_PRODUCER_TOKENS_PER_SCENE.output;
    expect(estimate.producerTokens).toEqual({ input, output });
    expect(estimate.usd).toBe(Math.round(((input / 1e6) * 0.15 + (output / 1e6) * 0.6) * 1e4) / 1e4);
  });

  it('keeps the tokens but answers a null USD when the model has no known price', () => {
    const estimate = estimateProduction(concept(), [], { ...OPENROUTER, pricing: null });

    expect(estimate.producerTokens).not.toBeNull();
    expect(estimate.usd).toBeNull();
  });
});
