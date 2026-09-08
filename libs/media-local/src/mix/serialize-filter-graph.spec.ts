import { describe, expect, it } from 'vitest';

import type { FilterGraph } from './filter-graph';
import { serializeFilterGraph } from './serialize-filter-graph';

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

const FIXTURE_STRING =
  "[0:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS,adelay=0:all=1,loudnorm=I=-14:TP=-1:LRA=11:print_format=json,aresample=48000[voice0];[1:a]atrim=start=0:end=7,asetpts=PTS-STARTPTS,adelay=0:all=1,volume=volume='min(1,pow(10,(lt(t,0)*(-12)+gte(t,0)*lt(t,0.866666667)*((-12)+(0)*(t-0))+gte(t,0.866666667)*lt(t,1)*((-12)+(-90)*(t-0.866666667))+gte(t,1)*lt(t,3.266666667)*((-24)+(0)*(t-1))+gte(t,3.266666667)*lt(t,3.666666667)*((-24)+(30)*(t-3.266666667))+gte(t,3.666666667)*lt(t,4.866666667)*((-12)+(0)*(t-3.666666667))+gte(t,4.866666667)*lt(t,5)*((-12)+(-90)*(t-4.866666667))+gte(t,5)*lt(t,6.266666667)*((-24)+(0)*(t-5))+gte(t,6.266666667)*lt(t,6.666666667)*((-24)+(30)*(t-6.266666667))+gte(t,6.666666667)*(-12))/20))':eval=frame,afade=t=in:st=0:d=0.5,afade=t=out:st=6:d=1,apad,atrim=end=7[music0];[voice0][music0]amix=inputs=2:duration=longest:normalize=0[mix]";

describe('serializeFilterGraph', () => {
  it('produce el string exacto del fixture del architect.md (§9.3, 855 caracteres)', () => {
    expect(serializeFilterGraph(FIXTURE_GRAPH)).toBe(FIXTURE_STRING);
    expect(serializeFilterGraph(FIXTURE_GRAPH)).toHaveLength(855);
  });

  it('una chain de un solo input y un solo filtro produce la gramatica minima sin separadores de mas', () => {
    const single: FilterGraph = {
      inputs: ['/a.wav'],
      chains: [{ inputLabels: ['0:a'], filters: ['anull'], outputLabels: ['out'] }],
      outputLabel: 'out',
    };

    expect(serializeFilterGraph(single)).toBe('[0:a]anull[out]');
  });
});
