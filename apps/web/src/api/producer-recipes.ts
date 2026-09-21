import type { Language } from '../i18n/language';
import type { TranslationKey } from '../i18n/messages-en';
import type { GeneratedListing } from './render-api-types';

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

export type RecipePromptContext = {
  hasTimedScript: boolean;
};

export async function loadRecipePrompt(
  id: ProducerRecipeId,
  language: Language,
  context: RecipePromptContext = { hasTimedScript: false },
): Promise<string> {
  const { PRODUCER_RECIPE_PROMPTS, RECIPE_SCRIPT_SENTENCES } = await import('./producer-recipe-prompts');
  const sentence = RECIPE_SCRIPT_SENTENCES[language][context.hasTimedScript ? 'present' : 'missing'];
  return PRODUCER_RECIPE_PROMPTS[id][language].replace('{script}', sentence);
}

export const PRODUCER_SCRIPT_PATH = 'work/producer/script.txt';

export function hasProducerScript(generated: GeneratedListing | null): boolean {
  return generated !== null && generated.files.some((file) => file.path === PRODUCER_SCRIPT_PATH);
}
