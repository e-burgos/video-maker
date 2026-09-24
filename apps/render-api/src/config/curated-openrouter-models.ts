export interface CuratedOpenRouterModel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

// Placeholder pending the tool-calling benchmark (plan.md D-C4-06); each id was checked against
// OpenRouter's public GET /api/v1/models for existence and supported_parameters including "tools".
export const CURATED_OPENROUTER_MODELS: readonly CuratedOpenRouterModel[] = [
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    description: 'Anthropic · fast, tool-calling',
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    description: 'OpenAI · fast, tool-calling',
  },
  {
    id: 'google/gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    description: 'Google · fast, tool-calling',
  },
];

export function isCuratedOpenRouterModel(id: string): boolean {
  return CURATED_OPENROUTER_MODELS.some((model) => model.id === id);
}
