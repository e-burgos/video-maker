import type { MotionOverview } from '../motion-types';

export function motionOverviewFixture(patch: Partial<MotionOverview> = {}): MotionOverview {
  return {
    storyboard: {
      version: 1,
      title: 'Promo de casas',
      brand: 'displayads',
      format: '16:9',
      beatSync: true,
      music: { track: 'drive', volume: 0.15 },
      scenes: [
        {
          id: 's1',
          kind: 'hero',
          vo: 'Encontrá tu casa',
          chapter: 'Intro',
          props: { title: 'Tu casa ideal', bullets: ['Rápido', 'Simple'], photo: 'images/casa.jpg', logo: 'brand:logo-main', count: 3 },
        },
        { id: 's2', kind: 'feature', vo: 'Con fotos reales', chapter: 'Intro', props: { title: 'Fotos reales' } },
        { id: 's3', kind: 'outro', vo: 'Gracias', chapter: 'Cierre', props: {} },
      ],
    },
    timeline: {
      durationSec: 30,
      bpm: 120,
      beatSync: true,
      musicCredit: 'Música: Drive',
      scenes: [
        { id: 's1', startSec: 0, endSec: 8.5, voStartSec: 0.5, voDurationSec: 4 },
        { id: 's2', startSec: 8.5, endSec: 20, voStartSec: 9, voDurationSec: 5 },
        { id: 's3', startSec: 20, endSec: 30, voStartSec: 20.5, voDurationSec: 2 },
      ],
    },
    voice: {
      scenes: [
        { sceneId: 's1', vo: 'Encontrá tu casa', voicedText: 'Encontrá tu casa', voice: 'es-AR-Elena', path: 'work/motion/voice/s1.mp3', durationSec: 3.4, stale: false },
        { sceneId: 's2', vo: 'Con fotos reales', voicedText: 'Con fotos', voice: 'es-AR-Elena', path: 'work/motion/voice/s2.mp3', durationSec: 2.1, stale: true },
        { sceneId: 's3', vo: 'Gracias', voicedText: null, voice: null, path: null, durationSec: null, stale: false },
      ],
    },
    video: {
      path: 'out/promo.mp4',
      creditsPath: 'out/promo.credits.txt',
      credits: 'Música: Drive',
      modifiedAt: '2026-10-08T00:00:00.000Z',
      outdated: false,
    },
    ...patch,
  };
}
