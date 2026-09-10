import { describe, expect, it } from 'vitest';

import { buildStoryboardDocument } from '../__fixtures__/storyboard-fixtures';
import { buildStoryboardSystemPrompt, buildStoryboardUserPrompt } from './build-storyboard-prompt';
import { EMPTY_STORYBOARD_INVENTORY } from './collect-storyboard-inventory';
import type { StoryboardInventory } from './collect-storyboard-inventory';

const INVENTORY_WITH_ASSETS: StoryboardInventory = {
  assets: [
    { id: 'raw/aroll/clip01.mp4', role: 'aroll', kind: 'video', durationMs: 12000 },
    { id: 'raw/images/logo.png', role: 'image', kind: 'image', durationMs: 0 },
  ],
  transcript: null,
  previousStoryboard: null,
};

describe('buildStoryboardSystemPrompt', () => {
  it('está en inglés y explica por qué cada prompt visual es autocontenido', () => {
    const prompt = buildStoryboardSystemPrompt();

    expect(prompt).toContain('self-contained');
    expect(prompt).toContain('repeat, verbatim, the visual description of every character');
    expect(prompt).toContain('remotion-scene');
  });

  it('pide que los campos legibles salgan en el idioma del pedido, no en inglés', () => {
    expect(buildStoryboardSystemPrompt()).toContain('in the language of the request, not in English');
  });
});

describe('buildStoryboardUserPrompt', () => {
  it('pide inventar el guion cuando llega un brief', () => {
    const prompt = buildStoryboardUserPrompt({
      brief: 'Un video corto sobre las trampas de un monorepo.',
      scriptText: null,
      inventory: EMPTY_STORYBOARD_INVENTORY,
    });

    expect(prompt).toContain('Write a storyboard for the idea below');
    expect(prompt).toContain('Un video corto sobre las trampas de un monorepo.');
    expect(prompt).not.toContain('# Script');
  });

  it('pide segmentar sin reescribir cuando llega un guion', () => {
    const prompt = buildStoryboardUserPrompt({
      brief: null,
      scriptText: 'Hola. Hoy vemos tres trampas.',
      inventory: EMPTY_STORYBOARD_INVENTORY,
    });

    expect(prompt).toContain('Split the script below into scenes without rewriting it');
    expect(prompt).toContain('Hola. Hoy vemos tres trampas.');
    expect(prompt).not.toContain('# Idea');
  });

  it('declara que no hay assets cuando el inventario está vacío', () => {
    const prompt = buildStoryboardUserPrompt({
      brief: 'idea',
      scriptText: null,
      inventory: EMPTY_STORYBOARD_INVENTORY,
    });

    expect(prompt).toContain('no scene may use visualSource asset');
  });

  it('lista cada asset del catálogo con su rol, kind y duración', () => {
    const prompt = buildStoryboardUserPrompt({
      brief: 'idea',
      scriptText: null,
      inventory: INVENTORY_WITH_ASSETS,
    });

    expect(prompt).toContain('- raw/aroll/clip01.mp4 (role: aroll, kind: video, duration: 12000 ms)');
    expect(prompt).toContain('- raw/images/logo.png (role: image, kind: image, duration: 0 ms)');
  });

  it('incluye la transcripción sólo cuando existe', () => {
    const withTranscript = buildStoryboardUserPrompt({
      brief: 'idea',
      scriptText: null,
      inventory: { ...INVENTORY_WITH_ASSETS, transcript: 'Hola, hoy vemos Nx.' },
    });
    const without = buildStoryboardUserPrompt({
      brief: 'idea',
      scriptText: null,
      inventory: INVENTORY_WITH_ASSETS,
    });

    expect(withTranscript).toContain('# Transcript of the footage already recorded');
    expect(withTranscript).toContain('Hola, hoy vemos Nx.');
    expect(without).not.toContain('# Transcript of the footage already recorded');
  });

  it('incluye el storyboard previo sólo cuando existe, con las descripciones de personaje', () => {
    const previous = buildStoryboardDocument();
    const withPrevious = buildStoryboardUserPrompt({
      brief: 'idea',
      scriptText: null,
      inventory: { ...INVENTORY_WITH_ASSETS, previousStoryboard: previous },
    });
    const without = buildStoryboardUserPrompt({
      brief: 'idea',
      scriptText: null,
      inventory: INVENTORY_WITH_ASSETS,
    });

    expect(withPrevious).toContain('# Previous storyboard');
    expect(withPrevious).toContain('Woman with short black hair and red framed glasses.');
    expect(without).not.toContain('# Previous storyboard');
  });
});
