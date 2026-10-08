export type BrandSource = 'built-in' | 'user';

export type BrandPalette = {
  background: string;
  accent: string;
  accent2: string;
  text: string;
};

export type BrandSummary = {
  id: string;
  name: string;
  source: BrandSource;
  logo: string | null;
  palette: BrandPalette | null;
  updatedAt: string;
};

export type BrandTypography = {
  display: string;
  body: string;
  mono?: string;
};

export type BrandFont = {
  family: string;
  file: string;
  weight?: string;
  unicodeRange?: string;
};

export type BrandDeviceKind = 'counter' | 'box' | 'screen';

export type BrandScreenPoint = [number, number];

export type BrandDevice = {
  name: string;
  image: string;
  kind: BrandDeviceKind;
  screen?: { polygon: BrandScreenPoint[]; skew?: number; rotate?: number; aspect?: number };
  spokenName?: string;
  plate?: boolean;
  retired?: boolean;
};

export type BrandDevices = Record<string, BrandDevice>;

export type BrandImage = string | { file: string; caption: string };

export type BrandTrack = {
  id: string;
  file: string;
  credit: string;
  bpm: number;
  mood: string;
  drop?: number;
};

export type BrandVoice = { id: string; lengthScale: number };

export type BrandManifest = {
  id: string;
  name: string;
  spokenName: string;
  tagline: string;
  taglineAccent?: string;
  url?: string;
  logo: string;
  isotipo?: string;
  css?: string;
  palette?: BrandPalette;
  tokens?: Record<string, string>;
  typography?: BrandTypography;
  fonts: BrandFont[];
  devices: Record<string, BrandDevice>;
  images: Record<string, BrandImage>;
  music: BrandTrack[];
  voice: BrandVoice;
};

export type BrandFiles = {
  images: string[];
  fonts: string[];
  music: string[];
  logos: string[];
};

export type BrandDetail = {
  id: string;
  source: BrandSource;
  manifest: BrandManifest;
  tokens: Record<string, string>;
  files: BrandFiles;
};

export const BRAND_FILE_KINDS = ['logo', 'image', 'device', 'font', 'music'] as const;

export type BrandFileKind = (typeof BRAND_FILE_KINDS)[number];

export type CreateBrandInput = {
  name: string;
  id?: string;
  duplicateFrom?: string;
};

export type UploadBrandFileInput = {
  id: string;
  kind: BrandFileKind;
  filename: string;
  contentType: string;
  body: Blob;
};

export type BrandPreview = {
  url: string;
  composedAt: string;
  durationSec: number;
};

export type BrandPreviewInput = { tagline?: string; headline?: string };
