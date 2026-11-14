import { StateBadge } from '@e-burgos/tucu-ui';
import { useEffect, useMemo, useState } from 'react';

import { producerEngineLabel } from '../../api/producer-engine-i18n';
import { translateProducerModel } from '../../api/producer-model-i18n';
import { useRenderApi } from '../../api/render-api-context';
import type { ProducerSettings, ProducerSettingsUpdate } from '../../api/render-api-types';
import { useApiAction } from '../../hooks/use-api-action';
import { useT } from '../../i18n/language-context';
import { ErrorNotice } from '../error-notice';
import { OpenRouterModelPicker } from '../openrouter-model-picker';
import { FIELD_CLASS, FIELD_LABEL_CLASS, SECONDARY_BUTTON_CLASS } from '../ui/cl-controls';
import { isProducerDraftDirty, producerDraftFromSettings, producerUpdateOf } from './producer-draft';
import type { EngineChoice, ProducerDraft } from './producer-draft';
import { ProducerEngineStatus } from './producer-engine-status';
import { useSettingsDraft } from './settings-drafts-context';
import { SettingsPanel } from './settings-panel';

export type ProducerEngineSectionProps = {
  settings: ProducerSettings;
  onSaved: () => void;
};

export function ProducerEngineSection({ settings, onSaved }: ProducerEngineSectionProps) {
  const client = useRenderApi();
  const t = useT();
  const saved = useMemo(() => producerDraftFromSettings(settings), [settings]);
  const [draft, setDraft] = useState<ProducerDraft>(saved);
  const [baseline, setBaseline] = useState<ProducerDraft>(saved);
  const [justSaved, setJustSaved] = useState(false);
  const save = useApiAction((update: ProducerSettingsUpdate) => client.updateProducerSettings(update));

  useEffect(() => {
    setDraft(saved);
    setBaseline(saved);
  }, [saved]);

  const dirty = isProducerDraftDirty(draft, baseline);
  const saving = save.status === 'pending';
  const keyPresent = settings.engines.openrouter.keyPresent;
  const recommendedIds = useMemo(
    () => new Set(settings.engines.openrouter.models.map((option) => option.id)),
    [settings],
  );

  async function saveDraft() {
    setJustSaved(false);
    const result = await save.run(producerUpdateOf(draft));
    if (result !== null) {
      setBaseline(draft);
      setJustSaved(true);
      onSaved();
    }
  }

  useSettingsDraft('producer-engine', { tab: 'producer', dirty, saving, save: saveDraft });

  return (
    <SettingsPanel
      testId="settings-producer-section"
      heading={t('settings.producerHeading')}
      description={t('settings.producerNote')}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="settings-engine" className={FIELD_LABEL_CLASS}>
          {t('settings.engineLabel')}
        </label>
        <select
          id="settings-engine"
          aria-label={t('settings.engineLabel')}
          value={draft.engine}
          onChange={(event) => setDraft({ ...draft, engine: event.target.value as EngineChoice })}
          className={FIELD_CLASS}
        >
          <option value="auto">{t('settings.engine.auto')}</option>
          <option value="claude-cli">{producerEngineLabel(t, 'claude-cli')}</option>
          <option value="openrouter">{producerEngineLabel(t, 'openrouter')}</option>
        </select>
      </div>

      <ProducerEngineStatus settings={settings} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="settings-model-claude" className={FIELD_LABEL_CLASS}>
          {t('settings.defaultModel.claude')}
        </label>
        <select
          id="settings-model-claude"
          aria-label={t('settings.defaultModel.claude')}
          value={draft.claudeModel}
          onChange={(event) => setDraft({ ...draft, claudeModel: event.target.value })}
          className={FIELD_CLASS}
        >
          {settings.engines.claudeCli.models.map((option) => {
            const translated = translateProducerModel(t, option);
            return (
              <option key={translated.id} value={translated.id}>
                {translated.label}
              </option>
            );
          })}
        </select>
      </div>

      {keyPresent && (
        <div className="flex flex-col gap-2">
          <p className={`m-0 ${FIELD_LABEL_CLASS}`}>{t('settings.defaultModel.openrouter')}</p>
          <OpenRouterModelPicker
            value={draft.openrouterModel}
            onChange={(openrouterModel) => setDraft({ ...draft, openrouterModel })}
            recommendedIds={recommendedIds}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void saveDraft()}
          className={SECONDARY_BUTTON_CLASS}
        >
          {saving ? t('settings.saving') : t('settings.save')}
        </button>
        {dirty && (
          <StateBadge tone="orange" dot size="sm" data-testid="settings-producer-unsaved">
            {t('edit.unsaved')}
          </StateBadge>
        )}
        {justSaved && !dirty && !saving && (
          <StateBadge tone="green" dot size="sm" data-testid="settings-producer-saved">
            {t('settings.saved')}
          </StateBadge>
        )}
      </div>

      {save.error !== null && <ErrorNotice error={save.error} surface="glass" />}
    </SettingsPanel>
  );
}
