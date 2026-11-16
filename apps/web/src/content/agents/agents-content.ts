import type { Language } from '../../i18n/language';

export const AGENT_IDS = ['claude-code', 'copilot', 'gemini', 'other'] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export type ConfigBlock = {
  id: string;
  label: string;
  code: string;
};

export type AgentSection = {
  title: string;
  lede: string;
  steps: readonly string[];
  blocks: readonly ConfigBlock[];
};

export type AgentsContent = {
  title: string;
  lede: string;
  studioNote: string;
  sections: Readonly<Record<AgentId, AgentSection>>;
};

export async function loadAgentsContent(language: Language): Promise<AgentsContent> {
  if (language === 'es') {
    return (await import('./agents-content-es')).AGENTS_ES;
  }
  return (await import('./agents-content-en')).AGENTS_EN;
}
