import type { VolumeAutomation } from '../timeline/build-duck-automation';
import type { SceneSlot } from '../timeline/layout-scenes';

export interface MotionTimeline {
  beatSync: boolean;
  duration: number;
  bpm: number;
  beatLength: number;
  beats: number[];
  scenes: SceneSlot[];
  musicAutomation: VolumeAutomation;
  musicCredit: string;
}

export interface SpokenWord {
  w: string;
  t: number;
  e: number;
}

export type SceneWords = Record<string, SpokenWord[]>;
