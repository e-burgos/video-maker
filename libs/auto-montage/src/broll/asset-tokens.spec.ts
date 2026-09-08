import { describe, expect, it } from 'vitest';

import { assetTokens } from './asset-tokens';

describe('assetTokens (D-14)', () => {
  it('tokeniza subcarpetas y el nombre de archivo, descartando el prefijo raw/rol y la extensión', () => {
    expect(assetTokens('raw/broll/cocina/sarten-hierro-02.mov', 4)).toEqual(
      new Set(['cocina', 'sarten', 'hierro']),
    );
  });

  it('descarta tokens puramente numéricos', () => {
    expect(assetTokens('raw/images/hardware/bateria_18650.jpg', 4)).toEqual(
      new Set(['hardware', 'bateria']),
    );
  });

  it('tokeniza un nombre de archivo simple sin subcarpetas', () => {
    expect(assetTokens('raw/broll/compilador-terminal.mp4', 4)).toEqual(
      new Set(['compilador', 'terminal']),
    );
  });

  it('descarta tokens más cortos que minTermLength, dejando un único token válido', () => {
    expect(assetTokens('raw/broll/clip-01.mp4', 4)).toEqual(new Set(['clip']));
  });

  it('quita tildes y mayúsculas al normalizar cada token', () => {
    expect(assetTokens('raw/broll/Sartén-Cocción.mp4', 4)).toEqual(
      new Set(['sarten', 'coccion']),
    );
  });

  it('descarta segmentos vacíos producidos por separadores consecutivos', () => {
    expect(assetTokens('raw/broll/cocina--sarten.mp4', 4)).toEqual(new Set(['cocina', 'sarten']));
  });

  it('un archivo sin extensión no pierde su último token', () => {
    expect(assetTokens('raw/broll/terminal', 4)).toEqual(new Set(['terminal']));
  });

  it('un nombre de archivo sin ningún token útil produce un set vacío', () => {
    expect(assetTokens('raw/broll/01-02.mp4', 4)).toEqual(new Set());
  });
});
