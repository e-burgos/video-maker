import { describe, expect, it } from 'vitest';

import { audioMixFfmpegArgs } from './audio-mix-ffmpeg-args';
import type { FilterGraph } from './filter-graph';

const FIXTURE_GRAPH: FilterGraph = {
  inputs: ['/assets/voice.wav', '/assets/music.mp3'],
  chains: [
    {
      inputLabels: ['0:a'],
      filters: [
        'atrim=start=0:end=7',
        'asetpts=PTS-STARTPTS',
        'adelay=0:all=1',
        'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
        'aresample=48000',
      ],
      outputLabels: ['voice0'],
    },
    {
      inputLabels: ['1:a'],
      filters: [
        'atrim=start=0:end=7',
        'asetpts=PTS-STARTPTS',
        'adelay=0:all=1',
        "volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,0.866666667)*((-12)+(0)*(t-0))+gte(t,0.866666667)*lt(t,1)*((-12)+(-90)*(t-0.866666667))+gte(t,1)*lt(t,3.266666667)*((-24)+(0)*(t-1))+gte(t,3.266666667)*lt(t,3.666666667)*((-24)+(30)*(t-3.266666667))+gte(t,3.666666667)*lt(t,4.866666667)*((-12)+(0)*(t-3.666666667))+gte(t,4.866666667)*lt(t,5)*((-12)+(-90)*(t-4.866666667))+gte(t,5)*lt(t,6.266666667)*((-24)+(0)*(t-5))+gte(t,6.266666667)*lt(t,6.666666667)*((-24)+(30)*(t-6.266666667))+gte(t,6.666666667)*(-12))/20))':eval=frame",
        'afade=t=in:st=0:d=0.5',
        'afade=t=out:st=6:d=1',
        'apad',
        'atrim=end=7',
      ],
      outputLabels: ['music0'],
    },
    {
      inputLabels: ['voice0', 'music0'],
      filters: ['amix=inputs=2:duration=longest:normalize=0'],
      outputLabels: ['mix'],
    },
  ],
  outputLabel: 'mix',
};

const FIXTURE_FILTER_COMPLEX =
  "[0:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS,adelay=0:all=1,loudnorm=I=-14:TP=-1:LRA=11:print_format=json,aresample=48000[voice0];[1:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS,adelay=0:all=1,volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,0.866666667)*((-12)+(0)*(t-0))+gte(t,0.866666667)*lt(t,1)*((-12)+(-90)*(t-0.866666667))+gte(t,1)*lt(t,3.266666667)*((-24)+(0)*(t-1))+gte(t,3.266666667)*lt(t,3.666666667)*((-24)+(30)*(t-3.266666667))+gte(t,3.666666667)*lt(t,4.866666667)*((-12)+(0)*(t-3.666666667))+gte(t,4.866666667)*lt(t,5)*((-12)+(-90)*(t-4.866666667))+gte(t,5)*lt(t,6.266666667)*((-24)+(0)*(t-5))+gte(t,6.266666667)*lt(t,6.666666667)*((-24)+(30)*(t-6.266666667))+gte(t,6.666666667)*(-12))/20))':eval=frame,afade=t=in:st=0:d=0.5,afade=t=out:st=6:d=1,apad,atrim=end=7[music0];[voice0][music0]amix=inputs=2:duration=longest:normalize=0[mix]";

describe('audioMixFfmpegArgs', () => {
  it('produce el array exacto de argumentos del fixture del architect.md (§9.4)', () => {
    const args = audioMixFfmpegArgs(FIXTURE_GRAPH, '/out/master.wav');

    expect(args).toEqual([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      '/assets/voice.wav',
      '-i',
      '/assets/music.mp3',
      '-filter_complex',
      FIXTURE_FILTER_COMPLEX,
      '-map',
      '[mix]',
      '-c:a',
      'pcm_s16le',
      '-ar',
      '48000',
      '-ac',
      '2',
      '/out/master.wav',
    ]);
  });

  it('sin objeto de opciones: dos parametros exactos, graph y outputPath (D-10)', () => {
    const args = audioMixFfmpegArgs(FIXTURE_GRAPH, '/other/out.wav');

    expect(args.at(-1)).toBe('/other/out.wav');
  });
});
