import { describe, expect, it } from 'vitest';

import type { FilterGraph } from '../mix/filter-graph';
import { DEFAULT_VOICE_TARGET } from './measure-loudness';
import {
  buildTruePeakLimiterFilter,
  MASTER_BUS_LIMITER_ATTACK_MS,
  MASTER_BUS_LIMITER_RELEASE_MS,
  MASTER_BUS_OUTPUT_LABEL,
  MASTER_BUS_TRUE_PEAK_MARGIN_DB,
  withMasterBusLimiter,
} from './master-bus-limiter';

describe('constantes del master bus (D-21/D-K)', () => {
  it('tienen los valores exactos de §3.7', () => {
    expect(MASTER_BUS_OUTPUT_LABEL).toBe('master');
    expect(MASTER_BUS_TRUE_PEAK_MARGIN_DB).toBe(1);
    expect(MASTER_BUS_LIMITER_ATTACK_MS).toBe(5);
    expect(MASTER_BUS_LIMITER_RELEASE_MS).toBe(50);
  });
});

describe('buildTruePeakLimiterFilter', () => {
  it('produce el filtro exacto para DEFAULT_VOICE_TARGET (§3.7)', () => {
    expect(buildTruePeakLimiterFilter(DEFAULT_VOICE_TARGET)).toBe(
      'alimiter=limit=0.794328235:attack=5:release=50:level=disabled',
    );
  });

  it('lleva level=disabled para no aplicar makeup gain (D-21)', () => {
    expect(buildTruePeakLimiterFilter(DEFAULT_VOICE_TARGET)).toContain('level=disabled');
  });

  it('el techo se calcula sobre truePeakDbtp - MASTER_BUS_TRUE_PEAK_MARGIN_DB, no truePeakDbtp a secas', () => {
    const target = { integratedLufs: -14, truePeakDbtp: -2, loudnessRange: 11 };

    expect(buildTruePeakLimiterFilter(target)).toBe(
      'alimiter=limit=0.707945784:attack=5:release=50:level=disabled',
    );
  });
});

describe('withMasterBusLimiter', () => {
  const baseGraph: FilterGraph = {
    inputs: ['/assets/voice.wav', '/assets/music.mp3'],
    chains: [
      {
        inputLabels: ['0:a'],
        filters: ['atrim=start=0:end=7'],
        outputLabels: ['voice0'],
      },
      {
        inputLabels: ['voice0', 'music0'],
        filters: ['amix=inputs=2:duration=longest:normalize=0'],
        outputLabels: ['mix'],
      },
    ],
    outputLabel: 'mix',
  };

  it('devuelve un FilterGraph nuevo sin mutar el recibido', () => {
    const result = withMasterBusLimiter(baseGraph, DEFAULT_VOICE_TARGET);

    expect(result).not.toBe(baseGraph);
    expect(result.chains).not.toBe(baseGraph.chains);
    expect(baseGraph.chains).toHaveLength(2);
    expect(baseGraph.outputLabel).toBe('mix');
  });

  it('apenda una cadena que toma el outputLabel del grafo recibido como entrada', () => {
    const result = withMasterBusLimiter(baseGraph, DEFAULT_VOICE_TARGET);

    expect(result.chains).toHaveLength(3);
    expect(result.chains[2]).toEqual({
      inputLabels: ['mix'],
      filters: ['alimiter=limit=0.794328235:attack=5:release=50:level=disabled'],
      outputLabels: [MASTER_BUS_OUTPUT_LABEL],
    });
  });

  it('expone MASTER_BUS_OUTPUT_LABEL como nuevo outputLabel y preserva inputs y las cadenas previas', () => {
    const result = withMasterBusLimiter(baseGraph, DEFAULT_VOICE_TARGET);

    expect(result.outputLabel).toBe(MASTER_BUS_OUTPUT_LABEL);
    expect(result.inputs).toBe(baseGraph.inputs);
    expect(result.chains[0]).toBe(baseGraph.chains[0]);
    expect(result.chains[1]).toBe(baseGraph.chains[1]);
  });
});
