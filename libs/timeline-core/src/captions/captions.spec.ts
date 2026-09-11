import { describe, expect, it } from 'vitest';

import {
  isolatedWordSurroundedByLongGaps,
  keywordSentenceWords,
  longWordExceedingMaxDuration,
  sevenConsecutiveWords,
  tieDurationWords,
} from '../__fixtures__/captions.fixture';
import { spanishTranscription } from '../__fixtures__/transcription';
import { defaultFormat } from '../format/format';
import type { CaptionGroupDecision, EditDecision } from '../schemas/edit-decision-list.schema';
import { EditDecisionListSchema } from '../schemas/edit-decision-list.schema';
import type { CaptionGroupPlan, TranscriptWord } from './group-words-for-captions';
import { groupWordsForCaptions, pickEmphasisIndex } from './group-words-for-captions';

function toCaptionGroupDecisions(plans: readonly CaptionGroupPlan[]): CaptionGroupDecision[] {
  return plans.map((plan) => ({
    id: plan.id,
    type: 'caption-group',
    startMs: plan.startMs,
    endMs: plan.endMs,
    words: plan.words,
    emphasisIndex: plan.emphasisIndex,
  }));
}

describe('groupWordsForCaptions', () => {
  it('CA-008: 7 palabras seguidas producen grupos de a lo sumo 3 palabras y ninguno supera 1200 ms', () => {
    const groups = groupWordsForCaptions(sevenConsecutiveWords);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.words.map((word) => word.text))).toEqual([
      ['uno', 'dos', 'tres'],
      ['cuatro', 'cinco', 'seis'],
      ['siete'],
    ]);
    for (const group of groups) {
      expect(group.words.length).toBeLessThanOrEqual(3);
      expect(group.endMs - group.startMs).toBeLessThanOrEqual(1200);
    }
  });

  it('CA-008: una palabra aislada por huecos >= 500 ms forma su propio grupo', () => {
    const groups = groupWordsForCaptions(isolatedWordSurroundedByLongGaps);

    expect(groups).toHaveLength(3);
    expect(groups[1]?.words).toEqual([
      { text: 'solo', startMs: 900, endMs: 1200 },
    ]);
  });

  it('una palabra más larga que maxDurationMs queda sola en su grupo, aunque lo supere', () => {
    const groups = groupWordsForCaptions(longWordExceedingMaxDuration);

    const longGroup = groups.find((group) => group.words[0]?.text === 'larguísima');
    expect(longGroup).toBeDefined();
    expect(longGroup?.words).toHaveLength(1);
    expect((longGroup?.endMs ?? 0) - (longGroup?.startMs ?? 0)).toBe(1500);
  });

  it('un grupo por debajo de minDurationMs se extiende, pero se clampea contra el siguiente grupo', () => {
    const words: TranscriptWord[] = [
      { text: 'a', startMs: 0, endMs: 100 },
      { text: 'b', startMs: 150, endMs: 250 },
    ];

    const groups = groupWordsForCaptions(words, { maxWords: 1 });

    expect(groups).toEqual([
      { id: 'cap-0001', startMs: 0, endMs: 150, words: [words[0]], emphasisIndex: 0 },
      { id: 'cap-0002', startMs: 150, endMs: 450, words: [words[1]], emphasisIndex: 0 },
    ]);
  });

  it('el último grupo se extiende hasta minDurationMs sin tope de siguiente grupo', () => {
    const groups = groupWordsForCaptions([{ text: 'hey', startMs: 0, endMs: 100 }]);

    expect(groups).toEqual([
      { id: 'cap-0001', startMs: 0, endMs: 300, words: [{ text: 'hey', startMs: 0, endMs: 100 }], emphasisIndex: 0 },
    ]);
  });

  it('devuelve [] para una lista vacía de palabras', () => {
    expect(groupWordsForCaptions([])).toEqual([]);
  });

  it('una sola palabra produce un único grupo', () => {
    const groups = groupWordsForCaptions([{ text: 'sola', startMs: 0, endMs: 500 }]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.words).toEqual([{ text: 'sola', startMs: 0, endMs: 500 }]);
  });

  it('maxWords menor a 1 se trata como 1', () => {
    const words: TranscriptWord[] = [
      { text: 'x', startMs: 0, endMs: 100 },
      { text: 'y', startMs: 150, endMs: 250 },
    ];

    const groups = groupWordsForCaptions(words, { maxWords: 0 });

    expect(groups.map((group) => group.words.length)).toEqual([1, 1]);
  });

  it('la transcripción en español completa produce grupos válidos (<=3 palabras, sin solapes)', () => {
    const groups = groupWordsForCaptions(spanishTranscription.words);

    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.words.length).toBeGreaterThanOrEqual(1);
      expect(group.words.length).toBeLessThanOrEqual(3);
      expect(group.endMs).toBeGreaterThan(group.startMs);
    }
    for (let index = 1; index < groups.length; index += 1) {
      const previous = groups[index - 1];
      const current = groups[index];
      expect(current?.startMs).toBeGreaterThanOrEqual(previous?.endMs ?? 0);
    }
  });
});

describe('pickEmphasisIndex', () => {
  it('CA-009: emphasisKeywords: ["gratis"] marca esa palabra, sin importar mayúsculas ni puntuación', () => {
    expect(pickEmphasisIndex(keywordSentenceWords, ['gratis'])).toBe(2);
  });

  it('CA-009: sin keywords marca la palabra de mayor duración', () => {
    expect(pickEmphasisIndex(keywordSentenceWords)).toBe(0);
  });

  it('RN-11: en caso de empate de duración, gana la última', () => {
    expect(pickEmphasisIndex(tieDurationWords)).toBe(1);
  });

  it('grupo vacío devuelve 0', () => {
    expect(pickEmphasisIndex([])).toBe(0);
  });

  it('keyword ausente en el grupo cae al criterio de mayor duración', () => {
    expect(pickEmphasisIndex(keywordSentenceWords, ['inexistente'])).toBe(0);
  });
});

describe('groupWordsForCaptions + EditDecisionListSchema', () => {
  it('las decisiones producidas validan dentro de una EditDecisionList', () => {
    const plans = groupWordsForCaptions(spanishTranscription.words, {
      emphasisKeywords: ['gratis'],
    });
    const lastWord = spanishTranscription.words[spanishTranscription.words.length - 1];
    const lastPlan = plans[plans.length - 1];
    const keepEndMs = Math.max(lastWord?.endMs ?? 0, lastPlan?.endMs ?? 0);

    const decisions: EditDecision[] = [
      { id: 'keep-0001', type: 'keep', startMs: 0, endMs: keepEndMs },
      ...toCaptionGroupDecisions(plans),
    ];

    const result = EditDecisionListSchema.safeParse({
      schemaVersion: 1,
      sourceAssetId: spanishTranscription.assetId,
      format: defaultFormat('reels-9x16'),
      generatedBy: { tool: 'captions.spec', params: {} },
      decisions,
    });

    expect(result.success).toBe(true);
  });
  it('una palabra que termina una oracion cierra el grupo aunque la siguiente arranque sin hueco (FIX-e-burgos-003-002)', () => {
    const groups = groupWordsForCaptions(
      [
        { text: 'que', startMs: 1410, endMs: 1600 },
        { text: 'vos.', startMs: 1600, endMs: 2740 },
        { text: 'En', startMs: 2740, endMs: 2860 },
        { text: 'nuestra', startMs: 2860, endMs: 3350 },
      ],
      { maxWords: 3, maxGapMs: 500, maxDurationMs: 2000 },
    );

    expect(groups.map((group) => group.words.map((word) => word.text))).toEqual([
      ['que', 'vos.'],
      ['En', 'nuestra'],
    ]);
  });
});

describe('groupWordsForCaptions con minWords (FIX-e-burgos-003-003)', () => {
  function sentenceWords(texts: readonly string[], stepMs = 400): TranscriptWord[] {
    return texts.map((text, index) => ({
      text,
      startMs: index * stepMs,
      endMs: index * stepMs + stepMs - 50,
    }));
  }

  const TWO_SENTENCES = sentenceWords([
    'Entramos',
    'a',
    'la',
    'plataforma',
    'con',
    'nuestro',
    'usuario.',
    'Las',
    'campañas',
    'viven',
    'acá.',
  ]);

  it('sin minWords corta en el fin de oración, como siempre', () => {
    const groups = groupWordsForCaptions(TWO_SENTENCES, { maxWords: 10, maxDurationMs: 10_000 });

    expect(groups[0]?.words).toHaveLength(7);
  });

  it('con minWords 6 el fin de oración deja de cortar hasta alcanzar el mínimo', () => {
    const groups = groupWordsForCaptions(sentenceWords(['Y', 'listo.', 'La', 'campaña', 'nace', 'en', 'borrador.']), {
      minWords: 6,
      maxWords: 10,
      maxDurationMs: 10_000,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.words).toHaveLength(7);
  });

  it('minWords nunca gana sobre maxWords', () => {
    const groups = groupWordsForCaptions(TWO_SENTENCES, {
      minWords: 9,
      maxWords: 4,
      maxDurationMs: 10_000,
    });

    expect(groups.every((group) => group.words.length <= 4)).toBe(true);
  });

  it('minWords nunca pega dos frases a través de un silencio', () => {
    const words: TranscriptWord[] = [
      { text: 'Y', startMs: 0, endMs: 300 },
      { text: 'listo.', startMs: 300, endMs: 800 },
      { text: 'La', startMs: 8000, endMs: 8200 },
      { text: 'campaña', startMs: 8200, endMs: 8800 },
    ];

    const groups = groupWordsForCaptions(words, {
      minWords: 6,
      maxWords: 10,
      maxDurationMs: 10_000,
      maxGapMs: 900,
    });

    expect(groups).toHaveLength(2);
    expect(groups[0]?.words.map((word) => word.text)).toEqual(['Y', 'listo.']);
  });

  it('minWords nunca gana sobre maxDurationMs', () => {
    const groups = groupWordsForCaptions(sentenceWords(['uno', 'dos', 'tres', 'cuatro'], 1500), {
      minWords: 6,
      maxWords: 10,
      maxDurationMs: 4000,
      maxGapMs: 3000,
    });

    expect(groups.length).toBeGreaterThan(1);
  });
});
