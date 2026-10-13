import { useCallback, useEffect, useState } from 'react';

import { useRenderApi } from '../api/render-api-context';
import { useApiAction } from '../hooks/use-api-action';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT } from '../i18n/language-context';
import { ErrorNotice } from './error-notice';
import { Button } from './ui/button';
import type { CategoryPlaylists } from '../api/publish-queue-types';
import type { VideoFolder } from '../api/render-api-types';
import type { YouTubePlaylist } from '../api/youtube-types';

type Loaded = {
  folders: VideoFolder[];
  playlists: YouTubePlaylist[];
  mapping: CategoryPlaylists;
};

const SELECT_CLASS =
  'w-full max-w-sm rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-50';

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
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-slate-400">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        className={SELECT_CLASS}
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
  const [justSaved, setJustSaved] = useState(false);
  const save = useApiAction((input: CategoryPlaylists) => client.putCategoryPlaylists(input));

  useEffect(() => {
    if (resource.data !== null) {
      setDraft(resource.data.mapping);
    }
  }, [resource.data]);

  const data = resource.data;

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
      setJustSaved(true);
    }
  }

  const hasCategories = data !== null && data.folders.some((folder) => folder.categories.length > 0);

  return (
    <div data-testid="youtube-category-playlists" className="space-y-3 border-t border-slate-800 pt-3">
      <h3 className="text-base font-semibold text-slate-100">{t('youtube.categoryPlaylists.heading')}</h3>
      <p className="text-sm text-slate-400">{t('youtube.categoryPlaylists.description')}</p>

      {resource.status === 'loading' && (
        <p className="text-sm text-slate-500">{t('youtube.categoryPlaylists.loading')}</p>
      )}
      {resource.status === 'error' && resource.error !== null && (
        <ErrorNotice error={resource.error} onRetry={resource.reload} />
      )}

      {data !== null && draft !== null && (
        <div className="space-y-4">
          <PlaylistSelect
            id="youtube-general-playlist"
            label={t('youtube.categoryPlaylists.general')}
            value={draft.generalPlaylistId}
            playlists={data.playlists}
            disabled={save.status === 'pending'}
            onChange={(playlistId) => {
              setJustSaved(false);
              setDraft({ ...draft, generalPlaylistId: playlistId });
            }}
          />

          {!hasCategories && (
            <p className="text-xs text-slate-500">{t('youtube.categoryPlaylists.noCategories')}</p>
          )}

          {data.folders
            .filter((folder) => folder.categories.length > 0)
            .map((folder) => (
              <fieldset key={folder.id} className="space-y-2">
                <legend className="text-sm font-medium text-slate-200">{folder.name}</legend>
                {folder.categories.map((category) => (
                  <PlaylistSelect
                    key={category.id}
                    id={`youtube-category-playlist-${category.id}`}
                    label={`${folder.name} › ${category.name}`}
                    value={draft.categoryPlaylists[category.id] ?? null}
                    playlists={data.playlists}
                    disabled={save.status === 'pending'}
                    onChange={(playlistId) => changeCategory(category.id, playlistId)}
                  />
                ))}
              </fieldset>
            ))}

          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={save.status === 'pending'} onClick={() => void submit()}>
              {save.status === 'pending' ? t('settings.saving') : t('youtube.categoryPlaylists.save')}
            </Button>
            {justSaved && (
              <span role="status" className="text-xs text-emerald-300">
                {t('youtube.categoryPlaylists.saved')}
              </span>
            )}
          </div>
          {save.error !== null && <ErrorNotice error={save.error} />}
        </div>
      )}
    </div>
  );
}
