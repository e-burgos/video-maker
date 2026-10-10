import { fitBeatGrid } from '../beats/fit-beat-grid';
import type { BeatGrid } from '../beats/fit-beat-grid';
import { parseHyperframesBeats } from '../beats/parse-hyperframes-beats';
import type { MotionTimeline } from '../template/motion-timeline';
import { DEFAULT_MUSIC_VOLUME } from '../script/motion-script';
import { buildDuckAutomation } from '../timeline/build-duck-automation';
import { layoutScenes } from '../timeline/layout-scenes';
import { wavDurationSec } from '../voice/wav-duration';
import { joinPath } from './join-path';
import type { MotionPipelinePorts } from './ports';
import { readScript, TIMELINE_FILE, toJson } from './project-files';

const MUSIC_TAIL = 0.5;
export const MUSIC_REFERENCE_LUFS = -24;
const SILENT_BPM = 120;

function silentGrid(durationSec: number): BeatGrid {
  const period = 60 / SILENT_BPM;
  const beats = Array.from({ length: Math.ceil(durationSec / period) + 1 }, (_, i) => Math.round(i * period * 1000) / 1000);
  return { bpm: SILENT_BPM, period, phase: 0, confidence: 0, beats };
}

const DUCK_RATIO = 0.3;

function musicLevels(volume: number): { bedLevel: number; duckLevel: number } {
  return { bedLevel: volume, duckLevel: Math.round(volume * DUCK_RATIO * 1000) / 1000 };
}

export async function planProject(ports: MotionPipelinePorts, project: string, options: { beatSync: boolean }): Promise<{ lines: string[]; timeline: MotionTimeline }> {
  const { beatSync } = options;
  const script = await readScript(ports, project);
  const voDurations = await Promise.all(
    script.scenes.map(async (scene) => wavDurationSec(await ports.readBytes(joinPath(project, 'assets', 'audio', `vo-${scene.id}.wav`)))),
  );
  const roughTotal = voDurations.reduce((sum, d) => sum + d + 4, 0) + 30;
  const musicSource = script.music === null ? null : joinPath(project, 'assets', 'music', script.music.file);
  const grid = musicSource === null ? silentGrid(roughTotal) : fitBeatGrid(parseHyperframesBeats(await ports.detectBeats(musicSource)), roughTotal);
  const slots = layoutScenes(script.scenes, voDurations, { beatSync, beats: grid.beats });
  const duration = slots.at(-1)?.end ?? 0;
  if (musicSource !== null) await ports.trimAudio({ from: musicSource, to: joinPath(project, 'assets', 'audio', 'music.wav'), durationSec: duration + MUSIC_TAIL, targetLufs: MUSIC_REFERENCE_LUFS });
  const timeline: MotionTimeline = {
    beatSync,
    duration,
    bpm: grid.bpm,
    beatLength: grid.period,
    beats: grid.beats.filter((b) => b <= duration),
    scenes: slots,
    musicAutomation: buildDuckAutomation(slots, duration, musicLevels(script.music?.volume ?? DEFAULT_MUSIC_VOLUME)),
    musicCredit: script.music?.credit ?? '',
  };
  await ports.writeText(joinPath(project, TIMELINE_FILE), toJson(timeline, 2));
  return {
    lines: [
      musicSource === null ? `plan: no music · ${SILENT_BPM} BPM pacing grid · ${duration} s` : `plan: ${grid.bpm} BPM (confidence ${grid.confidence}) · beat sync ${beatSync ? 'on' : 'off'} · ${duration} s`,
      ...slots.map((s) => `  ${s.id.padEnd(10)} ${s.start.toFixed(2).padStart(7)} → ${s.end.toFixed(2).padStart(7)}  voice ${s.voStart.toFixed(2)}+${s.voDuration.toFixed(2)}`),
    ],
    timeline,
  };
}
