import { describe, expect, it } from 'vitest';

import {
  VOICE_SCRIPT_MIN_LENGTH_SCALE,
  planVoiceScriptPlacements,
} from './plan-voice-script-placements';
import type { VoiceScriptPlacementRequest } from './plan-voice-script-placements';

function untimed(durationMs: number): VoiceScriptPlacementRequest {
  return { requestedStartMs: null, requestedEndMs: null, durationMs };
}

function timed(
  requestedStartMs: number,
  durationMs: number,
  requestedEndMs: number | null = null,
): VoiceScriptPlacementRequest {
  return { requestedStartMs, requestedEndMs, durationMs };
}

describe('planVoiceScriptPlacements (FIX-e-burgos-009-002)', () => {
  it('encadena las líneas sin marca desde 0 con gapMs, como el manifiesto anterior', () => {
    const placements = planVoiceScriptPlacements([untimed(2000), untimed(1500), untimed(1000)], {
      gapMs: 900,
    });

    expect(placements.map((placement) => placement.startMs)).toEqual([0, 2900, 5300]);
    expect(placements.map((placement) => placement.overflowMs)).toEqual([0, 0, 0]);
    expect(placements.map((placement) => placement.lengthScale)).toEqual([1, 1, 1]);
    expect(placements.map((placement) => placement.requestedStartMs)).toEqual([null, null, null]);
  });

  it('coloca cada línea marcada en su tiempo y deja silencio en el medio', () => {
    const placements = planVoiceScriptPlacements(
      [timed(0, 4000), timed(20_000, 6000), timed(28_000, 3000)],
      { gapMs: 900 },
    );

    expect(placements.map((placement) => [placement.startMs, placement.endMs])).toEqual([
      [0, 4000],
      [20_000, 26_000],
      [28_000, 31_000],
    ]);
    expect(placements.every((placement) => placement.overflowMs === 0)).toBe(true);
  });

  it('acorta la pausa antes de acelerar cuando la frase entra sin el colchón', () => {
    const placements = planVoiceScriptPlacements([timed(0, 7600), timed(8000, 1000)], {
      gapMs: 900,
    });

    expect(placements[0]?.lengthScale).toBe(1);
    expect(placements[0]?.overflowMs).toBe(0);
  });

  it('acelera con length-scale cuando la frase no entra ni sin colchón', () => {
    const placements = planVoiceScriptPlacements([timed(0, 9000), timed(8000, 1000)], {
      gapMs: 900,
    });

    expect(placements[0]?.lengthScale).toBe(0.88);
  });

  it('nunca acelera más allá del límite del 15 %', () => {
    const placements = planVoiceScriptPlacements([timed(0, 20_000), timed(8000, 1000)], {
      gapMs: 900,
    });

    expect(placements[0]?.lengthScale).toBe(VOICE_SCRIPT_MIN_LENGTH_SCALE);
  });

  it('respeta el fin del rango declarado como límite de la ventana', () => {
    const placements = planVoiceScriptPlacements([timed(0, 9000, 8000), untimed(1000)], {
      gapMs: 900,
    });

    expect(placements[0]?.lengthScale).toBe(0.88);
  });

  it('desplaza la línea siguiente y reporta el sobrante cuando ya no se puede acelerar', () => {
    const placements = planVoiceScriptPlacements([timed(0, 12_000), timed(8000, 1000)], {
      gapMs: 900,
      allowSpeedUp: false,
    });

    expect(placements[0]?.overflowMs).toBe(4000);
    expect(placements[1]?.startMs).toBe(12_000);
    expect(placements[1]?.requestedStartMs).toBe(8000);
  });

  it('no acelera cuando allowSpeedUp es false', () => {
    const placements = planVoiceScriptPlacements([timed(0, 9000), timed(8000, 1000)], {
      gapMs: 900,
      allowSpeedUp: false,
    });

    expect(placements[0]?.lengthScale).toBe(1);
  });

  it('no acelera una línea cuya ventana ya quedó vencida por el desplazamiento anterior', () => {
    const placements = planVoiceScriptPlacements(
      [timed(0, 12_000), timed(8000, 1000), timed(9000, 1000)],
      { gapMs: 900 },
    );

    expect(placements[1]?.lengthScale).toBe(1);
    expect(placements[1]?.startMs).toBe(12_000);
  });

  it('encadena con gapMs una línea sin marca que sigue a una marcada', () => {
    const placements = planVoiceScriptPlacements([timed(20_000, 3000), untimed(1000)], {
      gapMs: 900,
    });

    expect(placements[1]?.startMs).toBe(23_900);
  });
});
