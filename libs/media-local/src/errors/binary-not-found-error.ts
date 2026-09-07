import { MediaLocalError } from './media-local-error';

export class BinaryNotFoundError extends MediaLocalError {
  readonly code = 'BINARY_NOT_FOUND';
  readonly binary: string;
  readonly envVar: string | undefined;
  readonly searchedPaths: readonly string[];

  constructor(init: { binary: string; envVar?: string; searchedPaths?: readonly string[] }) {
    super(`No se encontró el binario "${init.binary}".`);
    this.name = 'BinaryNotFoundError';
    this.binary = init.binary;
    this.envVar = init.envVar;
    this.searchedPaths = init.searchedPaths ?? [];
  }
}
