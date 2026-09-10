import { describe, expect, it } from 'vitest';

import { classifyFileEntry, classifyTopLevelEntry } from './classify-entry';

describe('classifyTopLevelEntry', () => {
  it('asigna el role aroll a la carpeta aroll/', () => {
    expect(classifyTopLevelEntry({ name: 'aroll', isDirectory: true, isFile: false })).toEqual({
      kind: 'role',
      role: 'aroll',
    });
  });

  it('asigna el role image (singular) a la carpeta images/ (plural)', () => {
    expect(classifyTopLevelEntry({ name: 'images', isDirectory: true, isFile: false })).toEqual({
      kind: 'role',
      role: 'image',
    });
  });

  it('asigna el role voice a la carpeta voice/ de la locución propia (US-09-001)', () => {
    expect(classifyTopLevelEntry({ name: 'voice', isDirectory: true, isFile: false })).toEqual({
      kind: 'role',
      role: 'voice',
    });
  });

  it('ignora una carpeta con nombre desconocido con reason unknown-directory', () => {
    expect(classifyTopLevelEntry({ name: 'unknown-role', isDirectory: true, isFile: false })).toEqual({
      kind: 'ignored',
      reason: 'unknown-directory',
    });
  });

  it('ignora un archivo suelto bajo raw/ con reason unexpected-file', () => {
    expect(classifyTopLevelEntry({ name: 'README.md', isDirectory: false, isFile: true })).toEqual({
      kind: 'ignored',
      reason: 'unexpected-file',
    });
  });

  it('ignora un archivo oculto suelto bajo raw/ con reason hidden', () => {
    expect(classifyTopLevelEntry({ name: '.DS_Store', isDirectory: false, isFile: true })).toEqual({
      kind: 'ignored',
      reason: 'hidden',
    });
  });

  it('salta silenciosamente una carpeta oculta bajo raw/', () => {
    expect(classifyTopLevelEntry({ name: '.git', isDirectory: true, isFile: false })).toEqual({
      kind: 'skip',
    });
  });
});

describe('classifyFileEntry', () => {
  it('clasifica como asset un archivo cuya extensión coincide con el kind esperado del role', () => {
    expect(classifyFileEntry('clip01.mp4', 'aroll')).toEqual({ kind: 'asset' });
    expect(classifyFileEntry('clip01.mov', 'broll')).toEqual({ kind: 'asset' });
    expect(classifyFileEntry('photo01.jpg', 'image')).toEqual({ kind: 'asset' });
    expect(classifyFileEntry('music01.mp3', 'audio')).toEqual({ kind: 'asset' });
    expect(classifyFileEntry('scene-01.wav', 'voice')).toEqual({ kind: 'asset' });
  });

  it('ignora un video dentro de voice/ con reason extension-role-mismatch (US-09-001)', () => {
    expect(classifyFileEntry('toma.mp4', 'voice')).toEqual({
      kind: 'ignored',
      reason: 'extension-role-mismatch',
    });
  });

  it('ignora un archivo oculto con reason hidden', () => {
    expect(classifyFileEntry('.DS_Store', 'aroll')).toEqual({ kind: 'ignored', reason: 'hidden' });
  });

  it('ignora una extensión no soportada con reason unsupported-extension', () => {
    expect(classifyFileEntry('notes.txt', 'aroll')).toEqual({
      kind: 'ignored',
      reason: 'unsupported-extension',
    });
  });

  it('ignora un video dentro de images/ con reason extension-role-mismatch', () => {
    expect(classifyFileEntry('demo.mp4', 'image')).toEqual({
      kind: 'ignored',
      reason: 'extension-role-mismatch',
    });
  });

  it('ignora un audio dentro de aroll/ con reason extension-role-mismatch', () => {
    expect(classifyFileEntry('tema.mp3', 'aroll')).toEqual({
      kind: 'ignored',
      reason: 'extension-role-mismatch',
    });
  });
});
