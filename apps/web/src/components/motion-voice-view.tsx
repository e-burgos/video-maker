import { StateBadge } from '@e-burgos/tucu-ui';

import { artifactUrl } from '../api/artifact-url';
import type { MotionOverviewVoiceScene } from '../api/motion-types';
import { useMotionOverview } from '../hooks/use-motion-overview';
import { useT } from '../i18n/language-context';
import { MotionViewEmpty, MotionViewShell } from './motion-view-shell';
import { PANEL_CLASS, PANEL_HEADING_CLASS } from './ui/cl-controls';

export type MotionVoiceViewProps = {
  slug: string;
};

function VoiceSceneCard({ slug, scene }: { slug: string; scene: MotionOverviewVoiceScene }) {
  const t = useT();
  const spokenDiffers = scene.voicedText !== null && scene.voicedText !== scene.vo;

  return (
    <li
      data-testid="motion-voice-scene"
      data-stale={scene.stale ? 'true' : 'false'}
      className="glass-sub flex flex-col gap-2 rounded-[12px] p-3"
    >
      <p className="font-data m-0 flex flex-wrap items-center gap-2 text-xs text-[var(--cl-ink-3)]">
        <span>{scene.sceneId}</span>
        {scene.voice !== null && <span>{t('motionVoice.voice', { voice: scene.voice })}</span>}
        {scene.durationSec !== null && (
          <span>{t('motionVoice.duration', { seconds: scene.durationSec.toFixed(1) })}</span>
        )}
        {scene.stale && (
          <span data-testid="motion-voice-stale" title={t('motionVoice.staleHint')}>
            <StateBadge tone="orange" dot size="sm">
              {t('motionVoice.stale')}
            </StateBadge>
          </span>
        )}
      </p>
      <p className="m-0 text-sm text-[var(--cl-ink)]">{scene.vo}</p>
      {spokenDiffers && (
        <p className="m-0 text-xs text-[var(--cl-ink-2)]">{t('motionVoice.spoken', { text: scene.voicedText ?? '' })}</p>
      )}
      {scene.stale && <p className="m-0 text-xs text-[var(--tucu-state-orange-ink)]">{t('motionVoice.staleHint')}</p>}
      {scene.path === null ? (
        <p className="m-0 text-xs text-[var(--cl-ink-3)]">{t('motionVoice.noAudio')}</p>
      ) : (
        <audio controls preload="none" src={artifactUrl(slug, scene.path)} className="w-full max-w-md" />
      )}
    </li>
  );
}

export function MotionVoiceView({ slug }: MotionVoiceViewProps) {
  const t = useT();
  const overview = useMotionOverview(slug);
  const voice = overview.data?.voice ?? null;

  return (
    <MotionViewShell
      slug={slug}
      testId="motion-voice-view"
      loading={overview.status === 'loading'}
      error={overview.error}
      onRetry={overview.reload}
    >
      {overview.status === 'ready' && voice === null && (
        <MotionViewEmpty slug={slug} testId="motion-voice-empty" message={t('motionVoice.empty')} />
      )}

      {voice !== null && (
        <section className={PANEL_CLASS}>
          <h2 className={PANEL_HEADING_CLASS}>{t('motionVoice.title')}</h2>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {voice.scenes.map((scene) => (
              <VoiceSceneCard key={scene.sceneId} slug={slug} scene={scene} />
            ))}
          </ol>
        </section>
      )}
    </MotionViewShell>
  );
}
