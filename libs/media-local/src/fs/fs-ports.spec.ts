import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { nodeBinaryLookup } from './binary-lookup';
import { nodeReadTextFile } from './read-text-file';

const thisFile = fileURLToPath(import.meta.url);
const thisDir = fileURLToPath(new URL('.', import.meta.url));

describe('nodeBinaryLookup', () => {
  it('isExecutableFile es true para el binario de node en ejecución', async () => {
    await expect(nodeBinaryLookup.isExecutableFile(process.execPath)).resolves.toBe(true);
  });

  it('isExecutableFile es false para un archivo de texto sin permiso de ejecución', async () => {
    await expect(nodeBinaryLookup.isExecutableFile(thisFile)).resolves.toBe(false);
  });

  it('isExecutableFile es false para un archivo inexistente', async () => {
    await expect(nodeBinaryLookup.isExecutableFile('/no/existe/binario')).resolves.toBe(false);
  });

  it('isExecutableFile es false para un directorio', async () => {
    await expect(nodeBinaryLookup.isExecutableFile(thisDir)).resolves.toBe(false);
  });

  it('isReadableFile es true para un archivo de texto del propio repo', async () => {
    await expect(nodeBinaryLookup.isReadableFile(thisFile)).resolves.toBe(true);
  });

  it('isReadableFile es false para un archivo inexistente', async () => {
    await expect(nodeBinaryLookup.isReadableFile('/no/existe/archivo.json')).resolves.toBe(false);
  });

  it('isReadableDirectory es true para un directorio del propio repo', async () => {
    await expect(nodeBinaryLookup.isReadableDirectory(thisDir)).resolves.toBe(true);
  });

  it('isReadableDirectory es false para un archivo', async () => {
    await expect(nodeBinaryLookup.isReadableDirectory(thisFile)).resolves.toBe(false);
  });

  it('isReadableDirectory es false para un directorio inexistente', async () => {
    await expect(nodeBinaryLookup.isReadableDirectory('/no/existe/directorio')).resolves.toBe(false);
  });
});

describe('nodeReadTextFile', () => {
  it('lee el contenido de un archivo de texto del propio repo', async () => {
    await expect(nodeReadTextFile(thisFile)).resolves.toContain('nodeReadTextFile');
  });

  it('rechaza cuando el archivo no existe', async () => {
    await expect(nodeReadTextFile('/no/existe/archivo.json')).rejects.toThrow();
  });
});
