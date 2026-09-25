export type FreeMediaKind = 'video' | 'image';
export type FreeMediaSource = 'commons' | 'nasa';

export interface FreeMediaResult {
  readonly resultId: string;
  readonly source: FreeMediaSource;
  readonly kind: FreeMediaKind;
  readonly title: string;
  readonly license: string;
  readonly author: string;
  readonly pageUrl: string;
  readonly downloadUrl: string;
  readonly durationMs: number | null;
  readonly width: number | null;
  readonly height: number | null;
}
