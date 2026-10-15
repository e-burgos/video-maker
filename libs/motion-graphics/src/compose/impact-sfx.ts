export const IMPACT_VOICE_LEAD_IN_SEC = 0.8;
export const IMPACT_TRACK_VOLUME = 0.8;
export const IMPACT_DURATION_SEC = 2;
export const IMPACT_FADE_START_SEC = 0.35;
export const IMPACT_UNDER_VOICE_LEVEL = 0.03;

const impactAutomation = {
  version: 1,
  lanes: [{
    target: 'volume',
    points: [
      { t: 0, v: 1 },
      { t: IMPACT_FADE_START_SEC, v: 1 },
      { t: IMPACT_VOICE_LEAD_IN_SEC, v: IMPACT_UNDER_VOICE_LEVEL },
      { t: IMPACT_DURATION_SEC, v: IMPACT_UNDER_VOICE_LEVEL },
    ],
  }],
};

export function impactTrack(startPlaceholder: string, assetDir: string): string {
  return `<audio id="sfx-impact" src="${assetDir}/sfx/impact-bass-1.mp3" data-start="${startPlaceholder}" data-duration="${IMPACT_DURATION_SEC}" data-track-index="13" data-volume="${IMPACT_TRACK_VOLUME}" data-automation='${JSON.stringify(impactAutomation)}'></audio>`;
}
