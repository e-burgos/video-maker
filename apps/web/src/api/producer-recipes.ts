import type { Language } from '../i18n/language';
import type { TranslationKey } from '../i18n/messages-en';

export const PRODUCER_RECIPE_IDS = ['tutorial'] as const;

export type ProducerRecipeId = (typeof PRODUCER_RECIPE_IDS)[number];

export type ProducerRecipe = {
  id: ProducerRecipeId;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
};

export const PRODUCER_RECIPES: readonly ProducerRecipe[] = [
  {
    id: 'tutorial',
    labelKey: 'producer.recipe.tutorial.label',
    descriptionKey: 'producer.recipe.tutorial.description',
  },
];

export const RECIPE_PROMPT_HOLE = /\[[^[\]]+\]/u;

export function recipePromptHasHole(prompt: string): boolean {
  return RECIPE_PROMPT_HOLE.test(prompt);
}

export async function loadRecipePrompt(
  id: ProducerRecipeId,
  language: Language,
): Promise<string> {
  const { PRODUCER_RECIPE_PROMPTS } = await import('./producer-recipe-prompts');
  return PRODUCER_RECIPE_PROMPTS[id][language];
}
