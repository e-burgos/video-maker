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
    <section data-testid="voice-script-panel" className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
          {t('voice.script.heading')}{' '}
          <span className="text-slate-600">
            ({t('voice.script.lineCount', { count: manifest.lines.length })})
          </span>
        </h2>
        <p className="text-sm text-slate-400">{t('voice.script.description')}</p>
      </div>

      <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <audio
          data-testid="voice-script-audio"
          src={artifactUrl(slug, manifest.path)}
          controls
          preload="metadata"
          className="w-full"
        />
        <p className="font-mono text-xs text-slate-500">
          {t('voice.script.voice', { voiceId: manifest.voiceId })} ·{' '}
          {t('voice.script.duration', { seconds: totalDurationSeconds(manifest) })}
        </p>
      </div>

      <ul data-testid="voice-script-lines" className="space-y-2">
        {manifest.lines.map((line) => (
          <li
            key={line.index}
            data-testid="voice-script-line"
            data-line-index={line.index}
            className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-3"
          >
            <p className="font-mono text-xs text-slate-500">
              {t('voice.script.window', {
                start: formatTimecode(line.startMs),
                end: formatTimecode(lineEndMs(line)),
              })}
              {requestedStartOf(line) !== null && (
                <span className="ml-2 text-slate-600">
                  {t('voice.script.requested', {
                    start: formatTimecode(requestedStartOf(line) as number),
                  })}
                </span>
              )}
            </p>
            <p className="text-sm text-slate-200">{line.text}</p>
            {overflowOf(line) > 0 && (
              <p data-testid="voice-script-overflow" className="font-mono text-xs text-amber-300">
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
