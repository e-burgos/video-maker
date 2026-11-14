import { useTabParam } from '@e-burgos/tucu-ui';
import { useCallback } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { AppearanceSection } from '../components/settings/appearance-section';
import { ElevenLabsSettingsSection } from '../components/elevenlabs-settings-section';
import { ErrorNotice } from '../components/error-notice';
import { OpenRouterKeySection } from '../components/settings/openrouter-key-section';
import { ProducerEngineSection } from '../components/settings/producer-engine-section';
import { SettingsDraftsContext } from '../components/settings/settings-drafts-context';
import { SettingsTabBar } from '../components/settings/settings-tab-bar';
import { SettingsTabPanel } from '../components/settings/settings-tab-panel';
import { SETTINGS_TABS } from '../components/settings/settings-tabs';
import { useSettingsDrafts } from '../components/settings/use-settings-drafts';
import { useToolbarAction } from '../components/shell/use-toolbar-action';
import { HINT_TEXT_CLASS } from '../components/ui/cl-controls';
import { YouTubeSettingsSection } from '../components/youtube-settings-section';
import type { ProducerSettings } from '../api/render-api-types';

export function SettingsPage() {
  const client = useRenderApi();
  const t = useT();
  const [tab, setTab] = useTabParam({ values: SETTINGS_TABS });
  const drafts = useSettingsDrafts();

  const loadSettings = useCallback(() => client.getProducerSettings(), [client]);
  const settings = useAsyncResource<ProducerSettings>(loadSettings, 'producer-settings-page');
  const data = settings.data;

  useToolbarAction({
    label: t('settings.saveChanges'),
    onClick: () => void drafts.saveAll(),
    disabled: !drafts.hasChanges,
    loading: drafts.saving,
  });

  return (
    <SettingsDraftsContext.Provider value={drafts.registry}>
      <section data-testid="settings-page" className="flex flex-col gap-3">
        <SettingsTabBar active={tab} dirtyTabs={drafts.dirtyTabs} onSelect={setTab} />

        <SettingsTabPanel tab="producer" active={tab}>
          {settings.status === 'loading' && <p className={HINT_TEXT_CLASS}>{t('settings.loading')}</p>}
          {settings.status === 'error' && settings.error !== null && (
            <ErrorNotice error={settings.error} onRetry={settings.reload} surface="glass" />
          )}
          {data !== null && (
            <>
              <ProducerEngineSection settings={data} onSaved={settings.reload} />
              <OpenRouterKeySection
                keyPresent={data.engines.openrouter.keyPresent}
                keyHint={data.engines.openrouter.keyHint}
                onChanged={settings.reload}
              />
            </>
          )}
        </SettingsTabPanel>

        <SettingsTabPanel tab="voice" active={tab}>
          <ElevenLabsSettingsSection />
        </SettingsTabPanel>

        <SettingsTabPanel tab="youtube" active={tab}>
          <YouTubeSettingsSection />
        </SettingsTabPanel>

        <SettingsTabPanel tab="appearance" active={tab}>
          <AppearanceSection />
        </SettingsTabPanel>
      </section>
    </SettingsDraftsContext.Provider>
  );
}
