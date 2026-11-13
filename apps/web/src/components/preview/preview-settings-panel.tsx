import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CaptionTheme, Timeline } from '@video-maker/timeline-core';

import { canAddTextOverlay } from '../../api/timeline-edit/text-overlays';
import type { TimelineEditAction } from '../../api/timeline-edit/timeline-edit-state';
import { useT } from '../../i18n/language-context';
import { CaptionEditor } from '../caption-editor';
import { CaptionStyleSelector } from '../caption-style-selector';
import { ClipTrackEditor } from '../clip-track-editor';
import { LogoOverlayEditor } from '../logo-overlay-editor';
import { MusicMixEditor } from '../music-mix-editor';
import { OutputPresetSelector } from '../output-preset-selector';
import { TextOverlayEditor } from '../text-overlay-editor';
import { PreviewSettingsSection } from './preview-settings-section';
import { SETTINGS_SECTION_IDS, SETTINGS_SECTION_TITLE_KEYS, settingsSummaries } from './preview-settings-summary';
import type { SettingsSectionId } from './preview-settings-summary';

export type PreviewSettingsPanelProps = {
  slug: string;
  draft: Timeline;
  brandTheme: CaptionTheme | null;
  dispatch: (action: TimelineEditAction) => void;
};

export function PreviewSettingsPanel({ slug, draft, brandTheme, dispatch }: PreviewSettingsPanelProps) {
  const t = useT();
  const [openId, setOpenId] = useState<SettingsSectionId | null>(null);
  const summaries = settingsSummaries(draft, t);

  const bodies: Record<SettingsSectionId, ReactNode> = {
    output: <OutputPresetSelector preset={draft.format.preset} dispatch={dispatch} />,
    logo: (
      <LogoOverlayEditor
        slug={slug}
        {...(draft.logo === undefined ? {} : { logo: draft.logo })}
        {...(draft.bumpers === undefined ? {} : { bumpers: draft.bumpers })}
        dispatch={dispatch}
      />
    ),
    music: <MusicMixEditor music={draft.audioMix.music} dispatch={dispatch} />,
    aroll: <ClipTrackEditor track="aroll" clips={draft.tracks.aroll} dispatch={dispatch} />,
    broll: <ClipTrackEditor track="broll" clips={draft.tracks.broll} dispatch={dispatch} />,
    captions: (
      <>
        <CaptionStyleSelector
          {...(draft.captionStyle === undefined ? {} : { captionStyle: draft.captionStyle })}
          {...(draft.captionTheme === undefined ? {} : { captionTheme: draft.captionTheme })}
          brandTheme={brandTheme}
          dispatch={dispatch}
        />
        <CaptionEditor captions={draft.tracks.captions} dispatch={dispatch} />
      </>
    ),
    textOverlays: (
      <TextOverlayEditor
        {...(draft.textOverlays === undefined ? {} : { overlays: draft.textOverlays })}
        canAdd={canAddTextOverlay(draft)}
        dispatch={dispatch}
      />
    ),
  };

  return (
    <aside data-testid="preview-settings" className="glass flex min-w-0 flex-col gap-3 rounded-[20px] p-4">
      <h2 className="m-0 text-[15px] font-bold text-[var(--cl-ink)]">{t('preview.settings.heading')}</h2>
      <div className="flex flex-col gap-2">
        {SETTINGS_SECTION_IDS.map((id) => (
          <PreviewSettingsSection
            key={id}
            id={id}
            title={t(SETTINGS_SECTION_TITLE_KEYS[id])}
            summary={summaries[id]}
            open={openId === id}
            onOpenChange={(open) => setOpenId(open ? id : null)}
          >
            {bodies[id]}
          </PreviewSettingsSection>
        ))}
      </div>
      <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('preview.settings.hint')}</p>
    </aside>
  );
}
