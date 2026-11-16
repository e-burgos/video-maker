import type { ReactNode } from 'react';
import type { VoiceScriptLine, VoiceScriptManifest } from '@video-maker/timeline-core';

import { artifactUrl } from '../api/artifact-url';
import {
  formatTimecode,
  lineEndMs,
  overflowOf,
  requestedStartOf,
  totalDurationSeconds,
} from '../api/voice-script-lines';
import { useT } from '../i18n/language-context';

export type VoiceScriptPanelProps = {
  slug: string;
  manifest: VoiceScriptManifest;
  renderLineExtra?: (line: VoiceScriptLine) => ReactNode;
};

export function VoiceScriptPanel({ slug, manifest, renderLineExtra }: VoiceScriptPanelProps) {
  const t = useT();

  return (
    <section data-testid="voice-script-panel" className="glass min-w-0 flex flex-col gap-3 rounded-[20px] p-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-base font-bold text-[var(--cl-ink)]">
          {t('voice.script.heading')}{' '}
          <span className="font-data text-xs font-normal text-[var(--cl-ink-3)]">
            ({t('voice.script.lineCount', { count: manifest.lines.length })})
          </span>
        </h2>
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">{t('voice.script.description')}</p>
      </div>

      <div className="glass-sub flex flex-col gap-1 rounded-[14px] p-3">
        <audio
          data-testid="voice-script-audio"
          src={artifactUrl(slug, manifest.path)}
          controls
          preload="metadata"
          className="w-full"
        />
        <p className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
          {t('voice.script.voice', { voiceId: manifest.voiceId })} ·{' '}
          {t('voice.script.duration', { seconds: totalDurationSeconds(manifest) })}
        </p>
      </div>

      <ul data-testid="voice-script-lines" className="m-0 list-none flex flex-col gap-2 p-0">
        {manifest.lines.map((line) => (
          <li
            key={line.index}
            data-testid="voice-script-line"
            data-line-index={line.index}
            className="glass-sub flex flex-col gap-1 rounded-[14px] p-3"
          >
            <p className="font-data m-0 text-xs text-[var(--cl-ink-2)]">
              {t('voice.script.window', {
                start: formatTimecode(line.startMs),
                end: formatTimecode(lineEndMs(line)),
              })}
              {requestedStartOf(line) !== null && (
                <span className="ml-2 text-[var(--cl-ink-3)]">
                  {t('voice.script.requested', {
                    start: formatTimecode(requestedStartOf(line) as number),
                  })}
                </span>
              )}
            </p>
            <p className="m-0 text-sm text-[var(--cl-ink)]">{line.text}</p>
            {overflowOf(line) > 0 && (
              <p
                data-testid="voice-script-overflow"
                className="font-data m-0 text-xs text-[var(--tucu-state-orange-ink)]"
              >
                {t('voice.script.overflow', { ms: overflowOf(line) })}
              </p>
            )}
            {renderLineExtra?.(line)}
          </li>
        ))}
      </ul>
    </section>
  );
}
