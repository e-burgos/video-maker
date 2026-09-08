import { describe, expect, it } from 'vitest';

import { hardwarePreset } from '../presets/hardware.preset';
import { softwareDemoPreset } from '../presets/software-demo.preset';
import type { BrollCandidate } from './build-broll-index';
import { selectBrollAsset } from './select-broll-asset';

function candidate(
  assetId: string,
  role: BrollCandidate['role'],
  tokens: readonly string[],
): BrollCandidate {
  return { assetId, role, kind: role === 'image' ? 'image' : 'video', durationMs: 5000, tokens: new Set(tokens) };
}

describe('selectBrollAsset (CA-009 §5.3)', () => {
  it('devuelve undefined cuando ningún candidato tiene el término', () => {
    const index = [candidate('raw/broll/cocina.mp4', 'broll', ['cocina'])];

    expect(selectBrollAsset('python', index, softwareDemoPreset)).toBeUndefined();
  });

  it('devuelve el único candidato que matchea el término', () => {
    const index = [candidate('raw/broll/python.mp4', 'broll', ['python'])];

    expect(selectBrollAsset('python', index, softwareDemoPreset)?.assetId).toBe(
      'raw/broll/python.mp4',
    );
  });

  it('a igual rol, gana el candidato más específico (menor cantidad de tokens)', () => {
    const index = [
      candidate('raw/broll/compilador-terminal-demo.mp4', 'broll', ['compilador', 'terminal', 'demo']),
      candidate('raw/broll/compilador.mp4', 'broll', ['compilador']),
    ];

    expect(selectBrollAsset('compilador', index, softwareDemoPreset)?.assetId).toBe(
      'raw/broll/compilador.mp4',
    );
  });

  it('empate broll/images resuelto por A-2: software-demo prioriza broll/ (rolePriority)', () => {
    const index = [
      candidate('raw/images/python.jpg', 'image', ['python']),
      candidate('raw/broll/python.mp4', 'broll', ['python']),
    ];

    expect(selectBrollAsset('python', index, softwareDemoPreset)?.assetId).toBe(
      'raw/broll/python.mp4',
    );
  });

  it('empate broll/images resuelto por A-2: hardware prioriza images/ (rolePriority)', () => {
    const index = [
      candidate('raw/broll/puerto.mp4', 'broll', ['puerto']),
      candidate('raw/images/puerto.jpg', 'image', ['puerto']),
    ];

    expect(selectBrollAsset('puerto', index, hardwarePreset)?.assetId).toBe(
      'raw/images/puerto.jpg',
    );
  });

  it('desempate final por assetId ascendente cuando rol y especificidad empatan, sin importar el orden de entrada', () => {
    const zebra = candidate('raw/broll/zebra.mp4', 'broll', ['python']);
    const alpha = candidate('raw/broll/alpha.mp4', 'broll', ['python']);

    expect(selectBrollAsset('python', [zebra, alpha], softwareDemoPreset)?.assetId).toBe(
      'raw/broll/alpha.mp4',
    );
    expect(selectBrollAsset('python', [alpha, zebra], softwareDemoPreset)?.assetId).toBe(
      'raw/broll/alpha.mp4',
    );
  });

  it('un candidato peor no reemplaza al mejor ya encontrado', () => {
    const index = [
      candidate('raw/broll/compilador.mp4', 'broll', ['compilador']),
      candidate('raw/broll/compilador-terminal-demo.mp4', 'broll', ['compilador', 'terminal', 'demo']),
    ];

    expect(selectBrollAsset('compilador', index, softwareDemoPreset)?.assetId).toBe(
      'raw/broll/compilador.mp4',
    );
  });
});
