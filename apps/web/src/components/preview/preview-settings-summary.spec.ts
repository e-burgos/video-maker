import { describe, expect, it } from 'vitest';

import { editableTimelineFixture } from '../../api/__fixtures__/editable-timeline';
import { SETTINGS_SECTION_IDS, settingsSummaries } from './preview-settings-summary';
import type { TranslateFn } from '../../i18n/language-context';

const echo: TranslateFn = (key, params) =>
  params === undefined ? key : `${key}|${Object.entries(params).map(([name, value]) => `${name}=${value}`).join(',')}`;

describe('settingsSummaries', () => {
  it('gives every section a non-empty summary', () => {
    const summaries = settingsSummaries(editableTimelineFixture(), echo);

    SETTINGS_SECTION_IDS.forEach((id) => expect(summaries[id].length).toBeGreaterThan(0));
  });

  it('reports the music levels and the track counts the draft has', () => {
    const draft = editableTimelineFixture();
    const summaries = settingsSummaries(draft, echo);

    expect(summaries.music).toBe(
      `preview.summary.music|base=${draft.audioMix.music.baseGainDb},ducked=${draft.audioMix.music.duckedGainDb}`,
    );
    expect(summaries.aroll).toBe(`preview.summary.clips|count=${draft.tracks.aroll.length}`);
    expect(summaries.broll).toBe(`preview.summary.clips|count=${draft.tracks.broll.length}`);
  });

  it('says there is no logo when the draft has none', () => {
    const draft = editableTimelineFixture();
    delete draft.logo;

    expect(settingsSummaries(draft, echo).logo).toBe('preview.summary.logoOff');
  });
});
