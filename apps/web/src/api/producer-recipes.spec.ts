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

  it('asks for a farewell line in both languages when the scene table has none (FIX-e-burgos-015-007)', async () => {
    const spanish = await loadRecipePrompt('tutorial', 'es');
    const english = await loadRecipePrompt('tutorial', 'en');

    expect(spanish).toContain('El guion cierra siempre con una despedida');
    expect(spanish).toContain('¡Gracias por ver este tutorial! Nos vemos en el próximo.');
    expect(english).toContain('The script always closes with a farewell');
    expect(english).toContain('¡Gracias por ver este tutorial! Nos vemos en el próximo.');
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

  it('offers a vertical twin of the tutorial recipe for Shorts, Reels and TikTok (FIX-e-burgos-015-008)', async () => {
    expect(PRODUCER_RECIPE_IDS).toContain('tutorial-vertical');
    expect(PRODUCER_RECIPES.map((recipe) => recipe.id)).toEqual([
      'tutorial',
      'tutorial-vertical',
      'product-ad',
    ]);

    const spanish = await loadRecipePrompt('tutorial-vertical', 'es');
    const english = await loadRecipePrompt('tutorial-vertical', 'en');

    expect(spanish).toContain('Receta Tutorial Vertical');
    expect(spanish).toContain('la grabación ya está en vertical');
    expect(spanish).toContain('arriba a la izquierda al 50 %');
    expect(spanish).toContain('Shorts, Reels y TikTok');
    expect(english).toContain('Vertical tutorial recipe');
    expect(english).toContain('the recording is already vertical');
    expect(english).toContain('top left at 50 %');
    expect(english).not.toBe(spanish);
  });

  it('keeps the classic subtitle default in the vertical recipe, switchable later (FIX-e-burgos-015-008)', async () => {
    expect(await loadRecipePrompt('tutorial-vertical', 'es')).toContain(
      'subtítulos clásicos abajo',
    );
    expect(await loadRecipePrompt('tutorial-vertical', 'en')).toContain(
      'classic subtitles at the bottom',
    );
  });

  it('offers a product ad recipe that asks for the message, not for a scene table (FIX-e-burgos-015-009)', async () => {
    expect(PRODUCER_RECIPE_IDS).toContain('product-ad');

    const spanish = await loadRecipePrompt('product-ad', 'es');
    const english = await loadRecipePrompt('product-ad', 'en');

    expect(spanish).toContain('Receta Publicidad');
    expect(spanish).toContain('una foto por línea del guion');
    expect(spanish).toContain('llamado a la acción');
    expect(spanish).toContain('sin placa de inicio');
    expect(spanish).toContain('qué producto es');
    expect(english).toContain('Product ad recipe');
    expect(english).toContain('one photo per line of the script');
    expect(english).toContain('call to action');
    expect(english).toContain('no opening');
    expect(english).not.toBe(spanish);
  });

  it('keeps a hole in the ad prompt even when the project already has a script (FIX-e-burgos-015-009)', async () => {
    expect(recipePromptHasHole(await loadRecipePrompt('product-ad', 'es', { hasTimedScript: true }))).toBe(
      true,
    );
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
