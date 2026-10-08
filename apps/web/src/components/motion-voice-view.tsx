import { artifactUrl } from '../api/artifact-url';
import type { MotionOverviewVoiceScene } from '../api/motion-types';
import { useMotionOverview } from '../hooks/use-motion-overview';
import { useT } from '../i18n/language-context';
import { MotionViewEmpty, MotionViewShell } from './motion-view-shell';

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
      className="space-y-2 rounded-panel border border-border-subtle bg-surface-raised/40 p-3"
    >
      <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-ink-faint">
        <span>{scene.sceneId}</span>
        {scene.voice !== null && <span>{t('motionVoice.voice', { voice: scene.voice })}</span>}
        {scene.durationSec !== null && (
          <span>{t('motionVoice.duration', { seconds: scene.durationSec.toFixed(1) })}</span>
        )}
        {scene.stale && (
          <span
            data-testid="motion-voice-stale"
            title={t('motionVoice.staleHint')}
            className="rounded-full border border-warning px-2 py-0.5 text-warning"
          >
            {t('motionVoice.stale')}
          </span>
        )}
      </p>
      <p className="text-sm text-ink">{scene.vo}</p>
      {spokenDiffers && (
        <p className="text-xs text-ink-muted">
          {t('motionVoice.spoken', { text: scene.voicedText ?? '' })}
        </p>
      )}
      {scene.stale && <p className="text-xs text-warning">{t('motionVoice.staleHint')}</p>}
      {scene.path === null ? (
        <p className="text-xs text-ink-faint">{t('motionVoice.noAudio')}</p>
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
      title={t('motionVoice.title')}
      testId="motion-voice-view"
      loading={overview.status === 'loading'}
      error={overview.error}
      onRetry={overview.reload}
    >
      {overview.status === 'ready' && voice === null && (
        <MotionViewEmpty slug={slug} testId="motion-voice-empty" message={t('motionVoice.empty')} />
      )}

      {voice !== null && (
        <ol className="space-y-2">
          {voice.scenes.map((scene) => (
            <VoiceSceneCard key={scene.sceneId} slug={slug} scene={scene} />
          ))}
        </ol>
      )}
    </MotionViewShell>
  );
}
