import { SegmentedControl } from '@e-burgos/tucu-ui';
import type { Timeline } from '@video-maker/timeline-core';

import { PREVIEW_PRESETS } from '../../api/preview-format';
import type { PreviewPreset } from '../../api/preview-format';
import { useT } from '../../i18n/language-context';
import { TimelinePlayer } from '../timeline-player';

const PRESET_LABELS: Record<PreviewPreset, string> = {
  'reels-9x16': '9:16',
  'youtube-16x9': '16:9',
};

export type PreviewStagePanelProps = {
  playable: Timeline;
  captureFrame: number | null;
  onPresetChange: (preset: PreviewPreset) => void;
  summary: { canvas: string; duration: string; tracks: string };
};

function stageClass(portrait: boolean): string {
  return portrait
    ? 'relative mx-auto aspect-[9/16] h-[min(66vh,640px)] max-w-full overflow-hidden rounded-[12px] bg-[#0b0d14]'
    : 'relative aspect-video w-full overflow-hidden rounded-[12px] bg-[#0b0d14]';
}

export function PreviewStagePanel({ playable, captureFrame, onPresetChange, summary }: PreviewStagePanelProps) {
  const t = useT();
  const portrait = playable.format.height > playable.format.width;
  const options = PREVIEW_PRESETS.map((candidate) => ({
    value: candidate,
    label: PRESET_LABELS[candidate],
    'data-testid': `preview-format-${candidate}`,
  }));

  return (
    <section data-testid="preview-stage-panel" className="glass flex min-w-0 flex-col gap-3 rounded-[20px] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[15px] font-bold text-[var(--cl-ink)]">{t('preview.player.heading')}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--cl-ink-3)]">{t('preview.formatNote')}</span>
          <div className="glass-thin rounded-[10px] p-[3px]">
            <SegmentedControl
              size="xs"
              aria-label={t('preview.formatLabel')}
              options={options}
              value={playable.format.preset as PreviewPreset}
              onChange={(next) => onPresetChange(next as PreviewPreset)}
            />
          </div>
        </div>
      </div>

      <div data-testid="preview-stage" className={stageClass(portrait)}>
        <TimelinePlayer
          timeline={playable}
          fit
          {...(captureFrame !== null ? { initialFrame: captureFrame, controls: false } : {})}
        />
      </div>

      <dl className="font-data m-0 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--cl-ink-2)]">
        <div className="flex gap-1">
          <dt className="sr-only">{t('preview.canvas')}</dt>
          <dd data-testid="preview-canvas" className="m-0">
            {summary.canvas}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="sr-only">{t('preview.duration')}</dt>
          <dd data-testid="preview-duration" className="m-0">
            {summary.duration}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="sr-only">{t('preview.tracks')}</dt>
          <dd data-testid="preview-tracks" className="m-0">
            {summary.tracks}
          </dd>
        </div>
      </dl>
    </section>
  );
}
