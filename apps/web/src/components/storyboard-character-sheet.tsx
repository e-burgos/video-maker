import type { StoryboardDocument } from '@video-maker/timeline-core';

import { setCharacterField } from '../api/storyboard-edit/storyboard-document';
import { useT } from '../i18n/language-context';
import { FIELD_CLASS, FIELD_LABEL_CLASS, TEXTAREA_CLASS } from './ui/cl-controls';
import { EmptyState } from './ui/status-states';

export type StoryboardCharacterSheetProps = {
  storyboard: StoryboardDocument;
  onChange: (next: StoryboardDocument) => void;
};

export function StoryboardCharacterSheet({ storyboard, onChange }: StoryboardCharacterSheetProps) {
  const t = useT();

  return (
    <section
      data-testid="storyboard-character-sheet"
      className="glass flex flex-col gap-3 rounded-[20px] p-4"
    >
      <h2 className="m-0 text-sm font-bold text-[var(--cl-ink)]">
        {t('storyboardCharacters.heading')}{' '}
        <span className="font-data font-normal text-[var(--cl-ink-3)]">({storyboard.characters.length})</span>
      </h2>
      <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('storyboardCharacters.note')}</p>

      {storyboard.characters.length === 0 ? (
        <EmptyState message={t('storyboardCharacters.empty')} />
      ) : (
        <ul className="m-0 list-none flex flex-col gap-3 p-0">
          {storyboard.characters.map((character) => (
            <li key={character.id} className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
                {t('storyboardCharacters.name', { sceneId: character.id })}
                <input
                  value={character.name}
                  onChange={(event) =>
                    onChange(setCharacterField(storyboard, character.id, 'name', event.target.value))
                  }
                  className={FIELD_CLASS}
                />
              </label>
              <label className={`flex flex-col gap-1 ${FIELD_LABEL_CLASS}`}>
                {t('storyboardCharacters.visual', { sceneId: character.id })}
                <textarea
                  aria-label={t('storyboardCharacters.visual', { sceneId: character.id })}
                  rows={2}
                  value={character.visualDescription}
                  onChange={(event) =>
                    onChange(
                      setCharacterField(
                        storyboard,
                        character.id,
                        'visualDescription',
                        event.target.value,
                      ),
                    )
                  }
                  className={TEXTAREA_CLASS}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
