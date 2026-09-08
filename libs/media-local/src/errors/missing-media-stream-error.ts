import { MediaLocalError } from './media-local-error';

export type MissingStreamKind = 'audio' | 'video';

const MESSAGE_BY_STREAM: Record<MissingStreamKind, (path: string) => string> = {
  audio: (path) => `El archivo "${path}" no tiene stream de audio: no se puede medir ni mezclar.`,
  video: (path) => `El archivo "${path}" no tiene stream de video: no se puede muxear con -c:v copy.`,
};

export class MissingMediaStreamError extends MediaLocalError {
  readonly code = 'MISSING_MEDIA_STREAM';
  readonly path: string;
  readonly stream: MissingStreamKind;
  readonly assetId: string | undefined;

  constructor(init: { path: string; stream: MissingStreamKind; assetId?: string }) {
    super(MESSAGE_BY_STREAM[init.stream](init.path));
    this.name = 'MissingMediaStreamError';
    this.path = init.path;
    this.stream = init.stream;
    this.assetId = init.assetId;
  }
}
