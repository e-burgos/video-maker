import type { AskStoryboardAgent } from '../auto/generate-motion-storyboard';
import type { TakeTranscript } from '../voice/pick-best-take';

export interface RenderRequest {
  projectDir: string;
  outPath: string;
  fps: number;
  quality: string;
}

export interface MotionPipelinePorts {
  assetsRoot: string;
  userBrandsRoot?: string;
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  writeText(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  copyTree(from: string, to: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  synthesize(request: { text: string; voice: string; lengthScale: number; outPath: string }): Promise<void>;
  transcribe(wavPath: string): Promise<TakeTranscript>;
  detectBeats(musicPath: string): Promise<string>;
  trimAudio(request: { from: string; to: string; durationSec: number; targetLufs: number }): Promise<void>;
  render(request: RenderRequest): Promise<void>;
  askAgent: AskStoryboardAgent;
}
