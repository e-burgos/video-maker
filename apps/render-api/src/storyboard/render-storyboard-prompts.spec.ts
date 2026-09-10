import { describe, expect, it } from 'vitest';

import { buildStoryboardDocument } from '../__fixtures__/storyboard-fixtures';
import { renderStoryboardPrompts } from './render-storyboard-prompts';

describe('renderStoryboardPrompts', () => {
  const text = renderStoryboardPrompts(buildStoryboardDocument());

  it('encabeza con el título, el idioma, el formato y la cantidad de escenas', () => {
    expect(text.split('\n')[0]).toBe('# Tres trampas de un monorepo');
    expect(text).toContain('Language: es-AR · Format: 9:16 · Scenes: 3');
  });

  it('trae la hoja de personajes para pegar junto a cada prompt', () => {
    expect(text).toContain('## Characters');
    expect(text).toContain('- Ana: Woman with short black hair and red framed glasses.');
  });

  it('numera cada escena desde 01 para que el archivo generado se nombre por número', () => {
    expect(text).toContain('Save each generated file with the number of its scene');
    expect(text).toContain('01. [upload — generate this one and save it as the numbered file]');
    expect(text).toContain('02. [remotion-scene: code — no footage needed]');
    expect(text).toContain('03. [asset: raw/broll/desk.mp4 — already in the project]');
  });

  it('incluye el prompt visual de todas las escenas, también las que no se generan afuera', () => {
    expect(text).toContain('A terminal window with two conflicting lockfiles side by side.');
    expect(text).toContain('Closing shot of the studio desk, warm light.');
  });

  it('omite la hoja de personajes cuando el storyboard no tiene ninguno', () => {
    const withoutCharacters = renderStoryboardPrompts(buildStoryboardDocument({ characters: [] }));

    expect(withoutCharacters).not.toContain('## Characters');
    expect(withoutCharacters).toContain('## Visual prompts');
  });

  it('termina con exactamente un salto de línea', () => {
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });
});
