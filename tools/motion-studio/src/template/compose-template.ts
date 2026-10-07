import { MotionStudioError } from '../errors/motion-studio-error';
import type { MotionScript, MotionSfx } from '../script/motion-script';
import { normalizeWords } from '../voice/intelligibility-score';
import type { MotionTimeline, SceneWords } from './motion-timeline';

export const WHOOSH_LEAD = 0.28;
const PLACEHOLDER = /\{\{([a-z_:0-9-]+)\}\}/gu;

const round = (value: number): number => Math.round(value * 1000) / 1000;

export function wordTime(timeline: MotionTimeline, words: SceneWords, sceneId: string, prefix: string): number {
  const slot = timeline.scenes.find((scene) => scene.id === sceneId);
  const wanted = normalizeWords(prefix).join('');
  const found = (words[sceneId] ?? []).find((word) => normalizeWords(word.w).join('').startsWith(wanted));
  if (!slot || !found) {
    throw new MotionStudioError('WORD_NOT_FOUND', `word "${prefix}" not found in the voice of scene "${sceneId}"`);
  }
  return round(slot.voStart + found.t);
}

function sfxTime(sfx: MotionSfx, timeline: MotionTimeline, words: SceneWords): number {
  const sceneStart = timeline.scenes.find((scene) => scene.id === sfx.scene)?.start ?? 0;
  const base = sfx.word === null ? sceneStart : wordTime(timeline, words, sfx.scene, sfx.word);
  return round(Math.max(0, base + sfx.offset));
}

function voiceTracks(timeline: MotionTimeline): string {
  return timeline.scenes
    .map((s) => `<audio id="vo-${s.id}" src="assets/audio/vo-${s.id}.wav" data-start="${s.voStart}" data-duration="${s.voDuration}" data-track-index="11" data-volume="1"></audio>`)
    .join('\n      ');
}

function whooshTracks(timeline: MotionTimeline, script: MotionScript): string {
  return timeline.scenes
    .slice(1)
    .filter((s) => !script.noWhooshOn.includes(s.id))
    .map((s) => `<audio id="sfx-whoosh-${s.id}" src="assets/sfx/whoosh.mp3" data-start="${round(Math.max(0, s.start - WHOOSH_LEAD))}" data-duration="0.57" data-track-index="13" data-volume="0.35"></audio>`)
    .join('\n      ');
}

function withSceneText(timeline: MotionTimeline, script: MotionScript): MotionTimeline {
  const text = new Map(script.scenes.map((scene) => [scene.id, scene.vo]));
  return { ...timeline, scenes: timeline.scenes.map((slot) => ({ ...slot, vo: text.get(slot.id) ?? '' })) };
}

export function templateValues(script: MotionScript, timeline: MotionTimeline, words: SceneWords): Map<string, string> {
  const values = new Map<string, string>([
    ['duration', String(timeline.duration)],
    ['voice_tracks', voiceTracks(timeline)],
    ['whoosh_tracks', whooshTracks(timeline, script)],
    ['music_automation', JSON.stringify(timeline.musicAutomation)],
    ['music_credit', timeline.musicCredit],
    ['timeline_json', JSON.stringify(withSceneText(timeline, script))],
    ['words_json', JSON.stringify(words)],
  ]);
  for (const slot of timeline.scenes) {
    values.set(`start:${slot.id}`, String(slot.start));
    values.set(`dur:${slot.id}`, String(round(slot.end - slot.start)));
  }
  for (const sfx of script.sfx) values.set(`sfx:${sfx.id}`, String(sfxTime(sfx, timeline, words)));
  return values;
}

export function composeTemplate(template: string, script: MotionScript, timeline: MotionTimeline, words: SceneWords): string {
  const values = templateValues(script, timeline, words);
  return template.replace(PLACEHOLDER, (_, key: string) => {
    const value = values.get(key);
    if (value === undefined) throw new MotionStudioError('TEMPLATE_VALUE_MISSING', `template placeholder {{${key}}} has no value`);
    return value;
  });
}
