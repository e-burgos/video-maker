import { useCallback, useEffect, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { SettingsPanel } from './settings/settings-panel';
import { useSettingsDraft } from './settings/settings-drafts-context';
import { sameCategoryPlaylists } from './settings/category-playlists-draft';
import { FIELD_CLASS, FIELD_LABEL_CLASS, HINT_TEXT_CLASS, SECONDARY_BUTTON_CLASS } from './ui/cl-controls';
import { StateBadge } from '@e-burgos/tucu-ui';
import type { CategoryPlaylists } from '../api/publish-queue-types';
import type { VideoFolder } from '../api/render-api-types';
import type { YouTubePlaylist } from '../api/youtube-types';

type Loaded = {
  folders: VideoFolder[];
  playlists: YouTubePlaylist[];
  mapping: CategoryPlaylists;
};

function PlaylistSelect({
  id,
  label,
  value,
  playlists,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  playlists: YouTubePlaylist[];
  disabled: boolean;
  onChange: (playlistId: string | null) => void;
}) {
  const t = useT();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        className={`${FIELD_CLASS} w-full`}
      >
        <option value="">{t('youtube.categoryPlaylists.none')}</option>
        {playlists.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>
            {playlist.title}
          </option>
        ))}
      </select>
    </div>
  );
}

export function YouTubeCategoryPlaylistsSection() {
  const client = useRenderApi();
  const t = useT();
  const load = useCallback(async (): Promise<Loaded> => {
    const [organization, playlists, mapping] = await Promise.all([
      client.getOrganization(),
      client.listYouTubePlaylists(),
      client.getCategoryPlaylists(),
    ]);
    return { folders: organization.folders, playlists, mapping };
  }, [client]);
  const resource = useAsyncResource<Loaded>(load, 'youtube-category-playlists');
  const [draft, setDraft] = useState<CategoryPlaylists | null>(null);
  const [saved, setSaved] = useState<CategoryPlaylists | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const save = useApiAction((input: CategoryPlaylists) => client.putCategoryPlaylists(input));

  useEffect(() => {
    if (resource.data !== null) {
      setDraft(resource.data.mapping);
      setSaved(resource.data.mapping);
    }
  }, [resource.data]);

  const data = resource.data;
  const dirty = draft !== null && saved !== null && !sameCategoryPlaylists(draft, saved);
  const saving = save.status === 'pending';

  function changeCategory(categoryId: string, playlistId: string | null): void {
    setJustSaved(false);
    setDraft((current) =>
      current === null
        ? current
        : { ...current, categoryPlaylists: { ...current.categoryPlaylists, [categoryId]: playlistId } },
    );
  }

  async function submit() {
    if (draft === null) {
      return;
    }
    const result = await save.run(draft);
    if (result !== null) {
      setDraft(result);
      setSaved(result);
      setJustSaved(true);
    }
  }

  useSettingsDraft('youtube-category-playlists', { tab: 'youtube', dirty, saving, save: submit });

  const hasCategories = data !== null && data.folders.some((folder) => folder.categories.length > 0);

  return (
    <SettingsPanel
      testId="youtube-category-playlists"
      heading={t('youtube.categoryPlaylists.heading')}
      description={t('youtube.categoryPlaylists.description')}
    >
      {resource.status === 'loading' && <p className={HINT_TEXT_CLASS}>{t('youtube.categoryPlaylists.loading')}</p>}
      {resource.status === 'error' && resource.error !== null && (
        <ErrorNotice error={resource.error} onRetry={resource.reload} surface="glass" />
      )}

      {data !== null && draft !== null && (
        <div className="flex flex-col gap-4">
          <PlaylistSelect
            id="youtube-general-playlist"
            label={t('youtube.categoryPlaylists.general')}
            value={draft.generalPlaylistId}
            playlists={data.playlists}
            disabled={saving}
            onChange={(playlistId) => {
              setJustSaved(false);
              setDraft({ ...draft, generalPlaylistId: playlistId });
            }}
          />

          {!hasCategories && <p className={HINT_TEXT_CLASS}>{t('youtube.categoryPlaylists.noCategories')}</p>}

          {data.folders
            .filter((folder) => folder.categories.length > 0)
            .map((folder) => (
              <fieldset key={folder.id} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                <legend className="mb-1 p-0 text-sm font-semibold text-[var(--cl-ink)]">{folder.name}</legend>
                {folder.categories.map((category) => (
                  <PlaylistSelect
                    key={category.id}
                    id={`youtube-category-playlist-${category.id}`}
                    label={`${folder.name} › ${category.name}`}
                    value={draft.categoryPlaylists[category.id] ?? null}
                    playlists={data.playlists}
                    disabled={saving}
                    onChange={(playlistId) => changeCategory(category.id, playlistId)}
                  />
                ))}
              </fieldset>
            ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void submit()}
              className={SECONDARY_BUTTON_CLASS}
            >
              {saving ? t('settings.saving') : t('youtube.categoryPlaylists.save')}
            </button>
            {dirty && (
              <StateBadge tone="orange" dot size="sm" data-testid="youtube-category-playlists-unsaved">
                {t('edit.unsaved')}
              </StateBadge>
            )}
            {justSaved && !dirty && (
              <StateBadge tone="green" dot size="sm" role="status">
                {t('youtube.categoryPlaylists.saved')}
              </StateBadge>
            )}
          </div>
          {save.error !== null && <ErrorNotice error={save.error} surface="glass" />}
        </div>
      )}
    </SettingsPanel>
  );
}
