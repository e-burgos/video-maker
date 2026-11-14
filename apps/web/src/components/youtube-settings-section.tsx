import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useYouTubeConnectFlow } from '../hooks/use-youtube-connect-flow';
import { useYouTubeIntegration } from '../hooks/use-youtube-integration';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Modal } from './modal';
import { SettingsPanel } from './settings/settings-panel';
import {
  DANGER_BUTTON_SMALL_CLASS,
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  HINT_TEXT_CLASS,
  LINK_CLASS,
  SECONDARY_BUTTON_CLASS,
  WARNING_TEXT_CLASS,
} from './ui/cl-controls';
import { YouTubeCategoryPlaylistsSection } from './youtube-category-playlists-section';
import type { YouTubeIntegration } from '../api/youtube-types';

const GOOGLE_CLOUD_CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials';

function ChannelSummary({ integration }: { integration: YouTubeIntegration }) {
  const channel = integration.channel;
  if (channel === null) {
    return null;
  }

  return (
    <div data-testid="youtube-channel" className="flex items-center gap-3">
      {channel.thumbnailUrl !== null && (
        <img
          src={channel.thumbnailUrl}
          alt={channel.title}
          referrerPolicy="no-referrer"
          className="size-10 rounded-full border border-[var(--tucu-glass-sub-line)] object-cover"
        />
      )}
      <span className="text-sm font-semibold text-[var(--cl-ink)]">{channel.title}</span>
    </div>
  );
}

export function YouTubeSettingsSection() {
  const client = useRenderApi();
  const t = useT();
  const integration = useYouTubeIntegration();
  const data = integration.data;

  const [editingClient, setEditingClient] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const saveClient = useApiAction((credentials: { clientId: string; clientSecret: string }) =>
    client.putYouTubeClient(credentials),
  );
  const disconnect = useApiAction(() => client.disconnectYouTube());
  const connectFlow = useYouTubeConnectFlow(integration.reload);

  const showClientForm = data !== null && (!data.clientConfigured || editingClient);
  const credentialsComplete = clientId.trim() !== '' && clientSecret.trim() !== '';

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await saveClient.run({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    if (result !== null) {
      setClientId('');
      setClientSecret('');
      setEditingClient(false);
      integration.reload();
    }
  }

  async function confirmDisconnect() {
    const result = await disconnect.run();
    setConfirmingDisconnect(false);
    if (result !== null) {
      integration.reload();
    }
  }

  return (
    <>
      <SettingsPanel
        testId="settings-youtube-section"
        heading={t('youtube.settings.heading')}
        description={t('youtube.settings.description')}
      >
        {integration.status === 'loading' && <p className={HINT_TEXT_CLASS}>{t('youtube.settings.loading')}</p>}

        {integration.status === 'error' && integration.error !== null && (
          <ErrorNotice error={integration.error} onRetry={integration.reload} />
        )}

        {showClientForm && (
          <form onSubmit={submitClient} data-testid="youtube-client-form" className="flex flex-col gap-3">
            <p className="m-0 text-xs text-[var(--cl-ink-2)]">
              {t('youtube.settings.clientHelp')}{' '}
              <a href={GOOGLE_CLOUD_CREDENTIALS_URL} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>
                {t('youtube.settings.cloudConsole')}
              </a>{' '}
              ·{' '}
              <Link to="/learn?tab=guide#youtube" className={LINK_CLASS}>
                {t('youtube.settings.guideLink')}
              </Link>
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="youtube-client-id" className={FIELD_LABEL_CLASS}>
                {t('youtube.settings.clientId')}
              </label>
              <input
                id="youtube-client-id"
                type="text"
                autoComplete="off"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className={`${FIELD_CLASS} font-data w-full`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="youtube-client-secret" className={FIELD_LABEL_CLASS}>
                {t('youtube.settings.clientSecret')}
              </label>
              <input
                id="youtube-client-secret"
                type="password"
                autoComplete="off"
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                className={`${FIELD_CLASS} font-data w-full`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!credentialsComplete || saveClient.status === 'pending'}
                className={SECONDARY_BUTTON_CLASS}
              >
                {saveClient.status === 'pending' ? t('settings.saving') : t('youtube.settings.saveClient')}
              </button>
              {editingClient && (
                <button type="button" onClick={() => setEditingClient(false)} className={SECONDARY_BUTTON_CLASS}>
                  {t('youtube.settings.cancel')}
                </button>
              )}
            </div>
          </form>
        )}

        {data !== null && data.clientConfigured && !editingClient && !data.connected && (
          <div data-testid="youtube-connect" className="flex flex-col gap-2">
            {connectFlow.phase === 'idle' || connectFlow.phase === 'starting' || connectFlow.phase === 'timedOut' ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={connectFlow.phase === 'starting'}
                  onClick={() => void connectFlow.start()}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {connectFlow.phase === 'starting' ? t('youtube.settings.connecting') : t('youtube.settings.connect')}
                </button>
                <button type="button" onClick={() => setEditingClient(true)} className={SECONDARY_BUTTON_CLASS}>
                  {t('youtube.settings.changeClient')}
                </button>
              </div>
            ) : (
              <div data-testid="youtube-connect-waiting" role="status" className="flex flex-col gap-2">
                <p className="m-0 text-sm text-[var(--cl-ink)]">{t('youtube.settings.waiting')}</p>
                {connectFlow.authUrl !== null && (
                  <a
                    href={connectFlow.authUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`${LINK_CLASS} block break-all text-xs`}
                  >
                    {t('youtube.settings.openAgain')}
                  </a>
                )}
                <div>
                  <button type="button" onClick={connectFlow.cancel} className={SECONDARY_BUTTON_CLASS}>
                    {t('youtube.settings.cancel')}
                  </button>
                </div>
              </div>
            )}
            {connectFlow.phase === 'timedOut' && (
              <p role="alert" className={WARNING_TEXT_CLASS}>
                {t('youtube.settings.timedOut')}
              </p>
            )}
            {connectFlow.error !== null && <ErrorNotice error={connectFlow.error} />}
          </div>
        )}

        {data !== null && data.connected && !editingClient && (
          <div data-testid="youtube-connected" className="glass-sub flex flex-wrap items-center justify-between gap-3 rounded-[12px] p-3">
            <ChannelSummary integration={data} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setEditingClient(true)} className={SECONDARY_BUTTON_CLASS}>
                {t('youtube.settings.changeClient')}
              </button>
              <button type="button" onClick={() => setConfirmingDisconnect(true)} className={SECONDARY_BUTTON_CLASS}>
                {t('youtube.settings.disconnect')}
              </button>
            </div>
          </div>
        )}

        {saveClient.error !== null && <ErrorNotice error={saveClient.error} />}
        {disconnect.error !== null && <ErrorNotice error={disconnect.error} />}

        {confirmingDisconnect && (
          <Modal
            title={t('youtube.settings.disconnectTitle')}
            testId="youtube-disconnect-modal"
            onClose={() => setConfirmingDisconnect(false)}
            footer={
              <>
                <button
                  type="button"
                  onClick={() => setConfirmingDisconnect(false)}
                  disabled={disconnect.status === 'pending'}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {t('youtube.settings.cancel')}
                </button>
                <button
                  type="button"
                  data-testid="youtube-disconnect-accept"
                  onClick={() => void confirmDisconnect()}
                  disabled={disconnect.status === 'pending'}
                  className={DANGER_BUTTON_SMALL_CLASS}
                >
                  {disconnect.status === 'pending' ? t('youtube.settings.disconnecting') : t('youtube.settings.disconnect')}
                </button>
              </>
            }
          >
            <p>{t('youtube.settings.disconnectBody')}</p>
          </Modal>
        )}
      </SettingsPanel>

      {data !== null && data.connected && !editingClient && <YouTubeCategoryPlaylistsSection />}
    </>
  );
}
