import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { nodeBinaryLookup } from './binary-lookup';

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
});
