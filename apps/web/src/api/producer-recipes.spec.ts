import { describe, expect, it } from 'vitest';

import {
  PRODUCER_RECIPES,
  PRODUCER_RECIPE_IDS,
  loadRecipePrompt,
  recipePromptHasHole,
  hasProducerScript,
} from './producer-recipes';
import { LANGUAGES } from '../i18n/language';
import { MESSAGES_EN } from '../i18n/messages-en';
import { MESSAGES_ES } from '../i18n/messages-es';

describe('producer recipes', () => {
  it('offers the tutorial recipe first, since it is the one that already produced a video', () => {
    expect(PRODUCER_RECIPES[0]?.id).toBe('tutorial');
  });

  it('names every recipe through the catalog, in both languages', () => {
    for (const recipe of PRODUCER_RECIPES) {
      expect(MESSAGES_EN[recipe.labelKey]).toBeTruthy();
      expect(MESSAGES_ES[recipe.labelKey]).toBeTruthy();
      expect(MESSAGES_EN[recipe.descriptionKey]).toBeTruthy();
      expect(MESSAGES_ES[recipe.descriptionKey]).toBeTruthy();
      expect(MESSAGES_ES[recipe.descriptionKey]).not.toBe(MESSAGES_EN[recipe.descriptionKey]);
    }
  });

  it('declares a prompt for every recipe id in every supported language', async () => {
    for (const id of PRODUCER_RECIPE_IDS) {
      for (const language of LANGUAGES) {
        expect((await loadRecipePrompt(id, language)).length).toBeGreaterThan(200);
      }
    }
  });

  it('leaves a hole for what only the user knows, in every prompt', async () => {
    for (const id of PRODUCER_RECIPE_IDS) {
      for (const language of LANGUAGES) {
        expect(recipePromptHasHole(await loadRecipePrompt(id, language))).toBe(true);
      }
    }
  });

  it('reads a prompt with no hole as incomplete', () => {
    expect(recipePromptHasHole('Make a tutorial and render it.')).toBe(false);
  });

  it('names the recipe by the same word the producer system prompt keys on', async () => {
    expect(await loadRecipePrompt('tutorial', 'en')).toContain('Tutorial recipe');
    expect(await loadRecipePrompt('tutorial', 'es')).toContain('Receta Tutorial');
  });

  it('asks in plain language, exposing no preset, format or parameter id', async () => {
    const forbidden = [
      'youtube-16x9',
      'educational',
      'subtle-lower',
      'es_AR-daniela-high',
      'captionStyle',
      'widthRatio',
      'bumpers',
      'montage',
    ];

    for (const id of PRODUCER_RECIPE_IDS) {
      for (const language of LANGUAGES) {
        const prompt = await loadRecipePrompt(id, language);
        for (const token of forbidden) {
          expect(prompt).not.toContain(token);
        }
      }
    }
  });

  it('spells out in the tutorial prompt every decision of the video that worked', async () => {
    const spanish = await loadRecipePrompt('tutorial', 'es');

    expect(spanish).toContain('YouTube');
    expect(spanish).toContain('voz generada (Daniela, español rioplatense)');
    expect(spanish).toContain('sincronizada con lo que pasa en pantalla');
    expect(spanish).toContain('subtítulos clásicos abajo');
    expect(spanish).toContain('música libre suave de fondo con crédito');
    expect(spanish).toContain('logo transparente abajo a la derecha al 50 %');
    expect(spanish).toContain('placa de inicio y otra de cierre de 2 segundos con fondo blanco');
    expect(spanish).toContain('[pegá acá tu tabla de escenas, o decime que mire el video y te la proponga]');
  });

  it('says the same thing in english, word for word different', async () => {
    const english = await loadRecipePrompt('tutorial', 'en');

    expect(english).toContain('for YouTube');
    expect(english).toContain('generated voice (Daniela, Rioplatense Spanish)');
    expect(english).toContain('synchronized with what happens on screen');
    expect(english).toContain('classic subtitles at the bottom');
    expect(english).toContain('soft free background music with its credit');
    expect(english).toContain('transparent logo at the bottom right at 50 %');
    expect(english).toContain('2 second opening plate and closing plate with a white background');
    expect(english).toContain('[paste your table of scenes here, or tell me to watch the video and propose it to you]');
    expect(english).not.toBe(await loadRecipePrompt('tutorial', 'es'));
  });

  it('replaces the script hole with the project script when work/producer/script.txt exists (FIX-e-burgos-015-006)', async () => {
    const withScript = await loadRecipePrompt('tutorial', 'es', { hasTimedScript: true });
    const without = await loadRecipePrompt('tutorial', 'es');

    expect(withScript).toContain('usá el que ya está en el proyecto (work/producer/script.txt)');
    expect(recipePromptHasHole(withScript)).toBe(false);
    expect(recipePromptHasHole(without)).toBe(true);
    expect(hasProducerScript({ slug: 'x', roots: [], files: [{ path: 'work/producer/script.txt' } as never] })).toBe(true);
    expect(hasProducerScript(null)).toBe(false);
  });
});
