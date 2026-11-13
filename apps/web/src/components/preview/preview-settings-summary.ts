import type { Timeline } from '@video-maker/timeline-core';

import { outputPresetDetail } from '../../api/output-presets';
import { DEFAULT_CAPTION_STYLE } from '../../api/timeline-edit/caption-style';
import { logoSizeOf } from '../../api/timeline-edit/logo-overlay';
import type { TranslateFn } from '../../i18n/language-context';
import type { TranslationKey } from '../../i18n/messages-en';

export const SETTINGS_SECTION_IDS = ['output', 'logo', 'music', 'aroll', 'broll', 'captions', 'textOverlays'] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export const SETTINGS_SECTION_TITLE_KEYS: Readonly<Record<SettingsSectionId, TranslationKey>> = {
  output: 'preview.section.output',
  logo: 'preview.section.logo',
  music: 'preview.section.music',
  aroll: 'preview.section.aroll',
  broll: 'preview.section.broll',
  captions: 'preview.section.captions',
  textOverlays: 'preview.section.textOverlays',
};

export function settingsSummaries(draft: Timeline, t: TranslateFn): Record<SettingsSectionId, string> {
  const { logo, audioMix, tracks } = draft;

  return {
    output: t(outputPresetDetail(draft.format.preset).labelKey),
    logo:
      logo === undefined
        ? t('preview.summary.logoOff')
        : t('preview.summary.logo', {
            position: logo.position,
            size: t(`logo.size.${logoSizeOf(logo.widthRatio)}`),
          }),
    music: t('preview.summary.music', {
      base: audioMix.music.baseGainDb,
      ducked: audioMix.music.duckedGainDb,
    }),
    aroll: t('preview.summary.clips', { count: tracks.aroll.length }),
    broll: t('preview.summary.clips', { count: tracks.broll.length }),
    captions: t('preview.summary.captions', {
      style: draft.captionStyle ?? DEFAULT_CAPTION_STYLE,
      count: tracks.captions.length,
    }),
    textOverlays: t('preview.summary.textOverlays', { count: draft.textOverlays?.length ?? 0 }),
  };
}
