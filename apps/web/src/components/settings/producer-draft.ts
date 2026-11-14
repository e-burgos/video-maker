import type { ProducerEngineId, ProducerSettings, ProducerSettingsUpdate } from '../../api/render-api-types';

export type EngineChoice = ProducerEngineId | 'auto';

export type ProducerDraft = {
  engine: EngineChoice;
  claudeModel: string;
  openrouterModel: string;
};

export function producerDraftFromSettings(settings: ProducerSettings): ProducerDraft {
  return {
    engine: settings.engine ?? 'auto',
    claudeModel: settings.models.claude ?? settings.engines.claudeCli.models[0]?.id ?? '',
    openrouterModel: settings.models.openrouter ?? settings.engines.openrouter.models[0]?.id ?? '',
  };
}

export function isProducerDraftDirty(draft: ProducerDraft, saved: ProducerDraft): boolean {
  return (
    draft.engine !== saved.engine ||
    draft.claudeModel !== saved.claudeModel ||
    draft.openrouterModel !== saved.openrouterModel
  );
}

export function producerUpdateOf(draft: ProducerDraft): ProducerSettingsUpdate {
  return {
    engine: draft.engine === 'auto' ? null : draft.engine,
    models: { claude: draft.claudeModel, openrouter: draft.openrouterModel },
  };
}
