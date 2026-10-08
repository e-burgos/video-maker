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
          className="h-10 w-10 rounded-full border border-slate-700 object-cover"
        />
      )}
      <span className="text-sm font-medium text-slate-100">{channel.title}</span>
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
    <div
      data-testid="settings-youtube-section"
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="text-lg font-semibold text-slate-100">{t('youtube.settings.heading')}</h2>
      <p className="text-sm text-slate-400">{t('youtube.settings.description')}</p>

      {integration.status === 'loading' && (
        <p className="text-sm text-slate-500">{t('youtube.settings.loading')}</p>
      )}

      {integration.status === 'error' && integration.error !== null && (
        <ErrorNotice error={integration.error} onRetry={integration.reload} />
      )}

      {showClientForm && (
        <form onSubmit={submitClient} data-testid="youtube-client-form" className="space-y-3">
          <p className="text-xs text-slate-400">
            {t('youtube.settings.clientHelp')}{' '}
            <a
              href={GOOGLE_CLOUD_CREDENTIALS_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sky-300 underline hover:text-sky-200"
            >
              {t('youtube.settings.cloudConsole')}
            </a>{' '}
            ·{' '}
            <Link to="/guide#youtube" className="text-sky-300 underline hover:text-sky-200">
              {t('youtube.settings.guideLink')}
            </Link>
          </p>
          <div className="space-y-1">
            <label htmlFor="youtube-client-id" className="block text-sm text-slate-400">
              {t('youtube.settings.clientId')}
            </label>
            <input
              id="youtube-client-id"
              type="text"
              autoComplete="off"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="w-full max-w-lg rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="youtube-client-secret" className="block text-sm text-slate-400">
              {t('youtube.settings.clientSecret')}
            </label>
            <input
              id="youtube-client-secret"
              type="password"
              autoComplete="off"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              className="w-full max-w-lg rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!credentialsComplete || saveClient.status === 'pending'}
              className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
            >
              {saveClient.status === 'pending' ? t('settings.saving') : t('youtube.settings.saveClient')}
            </button>
            {editingClient && (
              <button
                type="button"
                onClick={() => setEditingClient(false)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
              >
                {t('youtube.settings.cancel')}
              </button>
            )}
          </div>
        </form>
      )}

      {data !== null && data.clientConfigured && !editingClient && !data.connected && (
        <div data-testid="youtube-connect" className="space-y-2">
          {connectFlow.phase === 'idle' || connectFlow.phase === 'starting' || connectFlow.phase === 'timedOut' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={connectFlow.phase === 'starting'}
                onClick={() => void connectFlow.start()}
                className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-100 disabled:opacity-40"
              >
                {connectFlow.phase === 'starting' ? t('youtube.settings.connecting') : t('youtube.settings.connect')}
              </button>
              <button
                type="button"
                onClick={() => setEditingClient(true)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
              >
                {t('youtube.settings.changeClient')}
              </button>
            </div>
          ) : (
            <div data-testid="youtube-connect-waiting" role="status" className="space-y-2">
              <p className="text-sm text-slate-300">{t('youtube.settings.waiting')}</p>
              {connectFlow.authUrl !== null && (
                <a
                  href={connectFlow.authUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block break-all text-xs text-sky-300 underline hover:text-sky-200"
                >
                  {t('youtube.settings.openAgain')}
                </a>
              )}
              <button
                type="button"
                onClick={connectFlow.cancel}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
              >
                {t('youtube.settings.cancel')}
              </button>
            </div>
          )}
          {connectFlow.phase === 'timedOut' && (
            <p role="alert" className="text-xs text-amber-300">
              {t('youtube.settings.timedOut')}
            </p>
          )}
          {connectFlow.error !== null && <ErrorNotice error={connectFlow.error} />}
        </div>
      )}

      {data !== null && data.connected && !editingClient && (
        <div data-testid="youtube-connected" className="space-y-3">
          <ChannelSummary integration={data} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDisconnect(true)}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-rose-500/60 hover:text-rose-200"
            >
              {t('youtube.settings.disconnect')}
            </button>
            <button
              type="button"
              onClick={() => setEditingClient(true)}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500"
            >
              {t('youtube.settings.changeClient')}
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
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
              >
                {t('youtube.settings.cancel')}
              </button>
              <button
                type="button"
                data-testid="youtube-disconnect-accept"
                onClick={() => void confirmDisconnect()}
                disabled={disconnect.status === 'pending'}
                className="rounded-md border border-rose-400/60 px-3 py-1.5 text-sm font-medium text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
              >
                {disconnect.status === 'pending' ? t('youtube.settings.disconnecting') : t('youtube.settings.disconnect')}
              </button>
            </>
          }
        >
          <p>{t('youtube.settings.disconnectBody')}</p>
        </Modal>
      )}
    </div>
  );
}
