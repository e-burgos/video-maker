import { formatPercent, roundSeconds } from '../api/reference-format';
import { formatClock } from '../api/review-format';
import { useT } from '../i18n/language-context';
import { ReferenceSceneStrip } from './reference-scene-strip';
import type { ReactNode } from 'react';
import type { ReferenceBrief } from '../api/reference-types';

export type ReferenceBriefViewProps = {
  slug: string;
  brief: ReferenceBrief;
};

type FactProps = { testId: string; label: string; value: string };

function Fact({ testId, label, value }: FactProps) {
  return (
    <div className="min-w-0 rounded-md border border-slate-800 px-2 py-1">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd data-testid={testId} className="break-words font-mono text-sm text-slate-200">
        {value}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

function FormatAndDuration({ brief }: { brief: ReferenceBrief }) {
  const t = useT();
  const { format } = brief;

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      <Fact
        testId="reference-format"
        label={t('reference.format')}
        value={t('reference.format.value', {
          width: String(format.width),
          height: String(format.height),
          fps: String(format.fps),
          orientation: t(`reference.orientation.${format.orientation}`),
        })}
      />
      <Fact
        testId="reference-duration"
        label={t('reference.duration')}
        value={t('reference.duration.value', { seconds: roundSeconds(brief.durationSec) })}
      />
    </dl>
  );
}

function PaceSection({ brief }: { brief: ReferenceBrief }) {
  const t = useT();
  const { pace } = brief;

  return (
    <Section title={t('reference.pace.heading')}>
      <dl className="grid gap-2 sm:grid-cols-3">
        <Fact testId="reference-cuts-per-minute" label={t('reference.pace.cuts')} value={String(pace.cutsPerMinute)} />
        <Fact
          testId="reference-mean-scene"
          label={t('reference.pace.mean')}
          value={t('reference.seconds', { value: roundSeconds(pace.meanSceneSec) })}
        />
        <Fact
          testId="reference-median-scene"
          label={t('reference.pace.median')}
          value={t('reference.seconds', { value: roundSeconds(pace.medianSceneSec) })}
        />
      </dl>
    </Section>
  );
}

function VoiceSection({ voice }: { voice: ReferenceBrief['voice'] }) {
  const t = useT();

  if (voice === null) {
    return (
      <Section title={t('reference.voice.heading')}>
        <p data-testid="reference-no-voice" className="text-sm text-slate-500">
          {t('reference.voice.none')}
        </p>
      </Section>
    );
  }

  return (
    <Section title={t('reference.voice.heading')}>
      <dl className="grid gap-2 sm:grid-cols-2">
        <Fact testId="reference-wpm" label={t('reference.voice.wpm')} value={String(voice.wordsPerMinute)} />
        <Fact
          testId="reference-speech-ratio"
          label={t('reference.voice.speech')}
          value={t('reference.voice.percent', { value: formatPercent(voice.speechRatio) })}
        />
      </dl>
      <details data-testid="reference-transcript" className="rounded-md border border-slate-800 px-2 py-1">
        <summary className="cursor-pointer text-xs text-slate-300">
          {t('reference.voice.transcript', { count: String(voice.transcript.length) })}
        </summary>
        <ul className="mt-1 space-y-1">
          {voice.transcript.map((phrase) => (
            <li key={`${phrase.startSec}-${phrase.text}`} className="flex gap-2 text-sm text-slate-300">
              <span className="shrink-0 font-mono text-xs text-slate-500">{formatClock(phrase.startSec)}</span>
              <span className="min-w-0 break-words">{phrase.text}</span>
            </li>
          ))}
        </ul>
      </details>
    </Section>
  );
}

function AudioSection({ audio }: { audio: ReferenceBrief['audio'] }) {
  const t = useT();
  const lufs =
    audio.integratedLufs === null
      ? t('reference.audio.lufs.unknown')
      : t('reference.audio.lufs.value', { value: audio.integratedLufs.toFixed(1) });

  return (
    <Section title={t('reference.audio.heading')}>
      <dl className="grid gap-2 sm:grid-cols-2">
        <Fact testId="reference-lufs" label={t('reference.audio.lufs')} value={lufs} />
        <div className="min-w-0 rounded-md border border-slate-800 px-2 py-1">
          <dt className="text-[11px] text-slate-500">{t('reference.audio.silences')}</dt>
          <dd data-testid="reference-silences" className="font-mono text-sm text-slate-200">
            {audio.longSilences.length === 0
              ? t('reference.audio.silences.none')
              : audio.longSilences
                  .map((silence) =>
                    t('reference.scene.range', {
                      start: formatClock(silence.startSec),
                      end: formatClock(silence.endSec),
                    }),
                  )
                  .join(' ')}
          </dd>
        </div>
      </dl>
    </Section>
  );
}

export function ReferenceBriefView({ slug, brief }: ReferenceBriefViewProps) {
  const t = useT();

  return (
    <div data-testid="reference-brief" className="min-w-0 space-y-3">
      <p data-testid="reference-summary" className="break-words text-sm text-slate-200">
        {brief.summary}
      </p>
      <FormatAndDuration brief={brief} />
      <PaceSection brief={brief} />
      <VoiceSection voice={brief.voice} />
      <AudioSection audio={brief.audio} />
      <Section title={t('reference.scenes.heading', { count: String(brief.scenes.length) })}>
        <ReferenceSceneStrip slug={slug} scenes={brief.scenes} />
      </Section>
    </div>
  );
}
