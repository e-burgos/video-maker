import type { AskStoryboardAgent } from '../../auto/generate-motion-storyboard';
import type { AutoStoryboardRequest } from '../../auto/build-auto-storyboard-request';
import type { TakeTranscript } from '../../voice/pick-best-take';

import type { MotionPipelinePorts, RenderRequest, SynthesizeRequest } from '../ports';

export function wavBytes(seconds: number): Uint8Array {
  const dataSize = Math.round(seconds * 1000) * 2;
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);
  const put = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  put(0, 'RIFF');
  put(8, 'WAVE');
  put(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint32(28, 2000, true);
  put(36, 'data');
  view.setUint32(40, dataSize, true);
  return bytes;
}

export interface FakePipelinePorts extends MotionPipelinePorts {
  files: Map<string, string | Uint8Array>;
  calls: string[];
  renders: RenderRequest[];
  asked: AutoStoryboardRequest[];
  synthesized: SynthesizeRequest[];
}

export function createFakePipelinePorts(init: {
  files?: Record<string, string | Uint8Array>;
  heard?: (text: string, take: number) => string;
  takeSeconds?: (text: string, take: number) => number;
  beatsJson?: string;
  answers?: Array<unknown | Error>;
  usage?: { inputTokens: number; outputTokens: number };
}): FakePipelinePorts {
  const files = new Map<string, string | Uint8Array>(Object.entries(init.files ?? {}));
  const calls: string[] = [];
  const renders: RenderRequest[] = [];
  const asked: AutoStoryboardRequest[] = [];
  const synthesized: SynthesizeRequest[] = [];
  const spoken = new Map<string, { text: string; take: number }>();
  const get = (path: string) => {
    const value = files.get(path);
    if (value === undefined) throw new Error(`ENOENT ${path}`);
    return value;
  };
  return {
    files,
    calls,
    renders,
    asked,
    synthesized,
    assetsRoot: '/repo/assets',
    readText: async (path) => String(get(path)),
    readBytes: async (path) => {
      const value = get(path);
      return typeof value === 'string' ? new TextEncoder().encode(value) : value;
    },
    writeText: async (path, content) => {
      files.set(path, content);
    },
    exists: async (path) => files.has(path) || [...files.keys()].some((k) => k.startsWith(`${path}/`)),
    copyTree: async (from, to) => {
      calls.push(`copyTree ${from} → ${to}`);
      for (const [path, value] of [...files]) if (path.startsWith(`${from}/`)) files.set(`${to}${path.slice(from.length)}`, value);
    },
    copyFile: async (from, to) => {
      files.set(to, get(from));
    },
    removeFile: async (path) => {
      files.delete(path);
    },
    synthesize: async (request) => {
      const { text, outPath } = request;
      synthesized.push(request);
      const take = Number(/take(\d+)/u.exec(outPath)?.[1] ?? 0);
      spoken.set(outPath, { text, take });
      calls.push(`synthesize ${outPath.slice(0, outPath.lastIndexOf('/'))} take${take}`);
      files.set(outPath, wavBytes(init.takeSeconds?.(text, take) ?? 2));
    },
    transcribe: async (path): Promise<TakeTranscript> => {
      const { text, take } = spoken.get(path) ?? { text: '', take: 0 };
      const heard = init.heard?.(text, take) ?? text;
      return { text: heard, words: heard.split(' ').map((w, i) => ({ text: w, start: i * 0.3, end: i * 0.3 + 0.25 })) };
    },
    detectBeats: async (path) => {
      calls.push(`detectBeats ${path}`);
      return init.beatsJson ?? JSON.stringify({ version: 1, beats: Array.from({ length: 400 }, (_, i) => ({ time: 0.04 + i * 0.5, strength: i % 4 === 0 ? 0.9 : 0.5 })) });
    },
    trimAudio: async ({ to, durationSec, targetLufs }) => {
      calls.push(`trimAudio ${to} ${durationSec} ${targetLufs}`);
      files.set(to, wavBytes(durationSec));
    },
    render: async (request) => {
      renders.push(request);
    },
    askAgent: (async (request) => {
      asked.push(request);
      const answer = init.answers?.[asked.length - 1];
      if (answer instanceof Error) throw answer;
      return { json: answer, usage: init.usage ?? { inputTokens: 1000, outputTokens: 200 } };
    }) satisfies AskStoryboardAgent,
  };
}
