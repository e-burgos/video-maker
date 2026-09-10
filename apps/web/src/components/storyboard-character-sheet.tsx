import type { StoryboardDocument } from '@video-maker/timeline-core';

import { setCharacterField } from '../api/storyboard-edit/storyboard-document';

export type StoryboardCharacterSheetProps = {
  storyboard: StoryboardDocument;
  onChange: (next: StoryboardDocument) => void;
};

export function StoryboardCharacterSheet({ storyboard, onChange }: StoryboardCharacterSheetProps) {
  return (
    <div
      data-testid="storyboard-character-sheet"
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
        character sheet <span className="text-slate-600">({storyboard.characters.length})</span>
      </h2>
      <p className="text-sm text-slate-400">
        Every visual prompt repeats these descriptions, which is what keeps a character consistent
        across shots generated one by one in an external tool.
      </p>

      {storyboard.characters.length === 0 ? (
        <p className="text-sm text-slate-600">This storyboard has no recurring characters.</p>
      ) : (
        <ul className="space-y-3">
          {storyboard.characters.map((character) => (
            <li key={character.id} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Name for {character.id}
                <input
                  value={character.name}
                  onChange={(event) =>
                    onChange(setCharacterField(storyboard, character.id, 'name', event.target.value))
                  }
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Visual description for {character.id}
                <textarea
                  aria-label={`Visual description for ${character.id}`}
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
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
