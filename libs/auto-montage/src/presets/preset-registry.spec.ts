import { describe, expect, it } from 'vitest';

import { MontageInputError } from '../errors/montage-input-error';
import type { MontagePreset, MontagePresetName } from './montage-preset';
import { MONTAGE_PRESETS, resolveMontagePreset } from './preset-registry';

const PRESET_NAMES: readonly MontagePresetName[] = [
  'software-demo',
  'hardware',
  'recipe',
  'educational',
];

const ALL_PRESETS: readonly MontagePreset[] = PRESET_NAMES.map((name) => MONTAGE_PRESETS[name]);

const AXES: readonly (readonly [string, (preset: MontagePreset) => string])[] = [
  [
    'poda',
    (preset) =>
      `${preset.silence.minSilenceMs}/${preset.silence.paddingMs}/${preset.silence.minKeepMs}`,
  ],
  ['punch-in', (preset) => `${preset.punchIn.every}/${preset.punchIn.scales.join(',')}`],
  ['densidad', (preset) => String(preset.broll.maxCoverageRatio)],
  ['transicion', (preset) => preset.transitions.kinds[0]],
];

describe('MONTAGE_PRESETS (CA-010)', () => {
  it('existen exactamente los 4 presets con los IDs esperados', () => {
    expect(Object.keys(MONTAGE_PRESETS).sort()).toEqual([...PRESET_NAMES].sort());
    ALL_PRESETS.forEach((preset, index) => {
      expect(preset.name).toBe(PRESET_NAMES[index]);
    });
  });

  describe.each(AXES)('eje %s', (_axisName, project) => {
    it('difiere entre los 4 presets', () => {
      expect(new Set(ALL_PRESETS.map(project)).size).toBe(4);
    });
  });

  it('rolePriority (D-15): exactamente dos presets de cada lado', () => {
    const projections = ALL_PRESETS.map((preset) => preset.broll.rolePriority.join('>'));
    const grouped = new Map<string, number>();
    projections.forEach((value) => {
      grouped.set(value, (grouped.get(value) ?? 0) + 1);
    });
    expect(grouped.size).toBe(2);
    expect([...grouped.values()]).toEqual([2, 2]);
  });

  it('cada preset tiene al menos un término de diccionario exclusivo, sin vacíos ni duplicados', () => {
    ALL_PRESETS.forEach((preset) => {
      expect(preset.concepts.dictionary.length).toBeGreaterThan(0);
      expect(new Set(preset.concepts.dictionary).size).toBe(preset.concepts.dictionary.length);
    });

    ALL_PRESETS.forEach((preset) => {
      const othersDictionary = new Set(
        ALL_PRESETS.filter((other) => other !== preset).flatMap((other) => other.concepts.dictionary),
      );
      const exclusiveTerms = preset.concepts.dictionary.filter((term) => !othersDictionary.has(term));
      expect(exclusiveTerms.length).toBeGreaterThan(0);
    });
  });

  it('órdenes relativos entre recipe y educational (RN-16)', () => {
    const recipe = MONTAGE_PRESETS.recipe;
    const educational = MONTAGE_PRESETS.educational;

    expect(recipe.silence.minSilenceMs).toBeLessThan(educational.silence.minSilenceMs);
    expect(recipe.broll.maxCoverageRatio).toBeGreaterThan(educational.broll.maxCoverageRatio);
    expect(recipe.punchIn.every).toBeLessThan(educational.punchIn.every);
    expect(recipe.transitions.every).toBeLessThan(educational.transitions.every);
  });

  it('invariante duro: punchIn.every >= 2 en los 4 presets (evita que planPunchIns cubra todo el keep)', () => {
    ALL_PRESETS.forEach((preset) => {
      expect(preset.punchIn.every).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('resolveMontagePreset (D-20)', () => {
  it('resuelve un MontagePresetName al preset del registro', () => {
    expect(resolveMontagePreset('recipe', '/tmp/project')).toBe(MONTAGE_PRESETS.recipe);
  });

  it('devuelve un MontagePreset completo tal cual, sin pasar por el registro', () => {
    const customPreset: MontagePreset = { ...MONTAGE_PRESETS.recipe, name: 'recipe' };

    expect(resolveMontagePreset(customPreset, '/tmp/project')).toBe(customPreset);
  });

  it('lanza MontageInputError con reason "unknown-preset" para un nombre que no está en el registro', () => {
    expect(() => resolveMontagePreset('cinematic' as MontagePresetName, '/tmp/project')).toThrow(
      MontageInputError,
    );

    try {
      resolveMontagePreset('cinematic' as MontagePresetName, '/tmp/project');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MontageInputError);
      expect((error as MontageInputError).reason).toBe('unknown-preset');
      expect((error as MontageInputError).projectRoot).toBe('/tmp/project');
    }
  });
});
