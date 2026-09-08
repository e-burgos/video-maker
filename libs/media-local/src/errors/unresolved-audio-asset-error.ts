import { MediaLocalError } from './media-local-error';

export class UnresolvedAudioAssetError extends MediaLocalError {
  readonly code = 'UNRESOLVED_AUDIO_ASSET';
  readonly assetId: string;
  readonly clipId: string;
  readonly track: 'voice' | 'music';

  constructor(init: { assetId: string; clipId: string; track: 'voice' | 'music' }) {
    super(
      `El clip de audio "${init.clipId}" (pista ${init.track}) referencia un assetId que no existe en la Timeline: "${init.assetId}".`,
    );
    this.name = 'UnresolvedAudioAssetError';
    this.assetId = init.assetId;
    this.clipId = init.clipId;
    this.track = init.track;
  }
}
