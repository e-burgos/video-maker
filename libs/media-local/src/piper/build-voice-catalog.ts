import { basename } from 'node:path';

export const VOICE_MODEL_EXTENSION = '.onnx';
export const VOICE_MODEL_CONFIG_EXTENSION = '.onnx.json';

export const VOICE_QUALITIES = ['x_low', 'low', 'medium', 'high'] as const;

export type VoiceQuality = (typeof VOICE_QUALITIES)[number];

export interface VoiceLanguage {
  readonly code: string;
  readonly region: string | null;
}

export interface VoiceModel {
  readonly id: string;
  readonly fileName: string;
  readonly isDefault: boolean;
  readonly language: VoiceLanguage;
  readonly quality: VoiceQuality | null;
  readonly label: string;
  readonly description: string;
}

export interface VoiceModelFile {
  readonly fileName: string;
  readonly config: unknown;
}

const MODEL_ID_PARTS = /^([a-z]{2,3})(?:_([A-Za-z]{2,4}))?-(.+?)(?:-(x_low|low|medium|high))?$/u;

const QUALITY_LABELS: Readonly<Record<VoiceQuality, string>> = {
  x_low: 'Very low quality',
  low: 'Low quality',
  medium: 'Medium quality',
  high: 'High quality',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isVoiceModelFile(fileName: string): boolean {
  return (
    fileName.endsWith(VOICE_MODEL_EXTENSION) && fileName.length > VOICE_MODEL_EXTENSION.length
  );
}

export function voiceModelId(fileName: string): string {
  return fileName.slice(0, -VOICE_MODEL_EXTENSION.length);
}

export function voiceModelConfigFileName(fileName: string): string {
  return `${fileName}.json`;
}

function isVoiceQuality(value: unknown): value is VoiceQuality {
  return typeof value === 'string' && (VOICE_QUALITIES as readonly string[]).includes(value);
}

function languageOf(id: string, config: Record<string, unknown> | null): VoiceLanguage {
  const declared = config === null ? null : config['language'];
  if (isRecord(declared)) {
    const code = readString(declared, 'code');
    const region = readString(declared, 'region');
    if (code !== null) {
      return { code: code.replace('_', '-'), region: region ?? code.split('_')[1] ?? null };
    }
  }

  const parts = MODEL_ID_PARTS.exec(id);
  if (parts === null) {
    return { code: id, region: null };
  }

  const [, language, region] = parts;
  return {
    code: region === undefined ? (language as string) : `${language}-${region}`,
    region: region ?? null,
  };
}

function qualityOf(id: string, config: Record<string, unknown> | null): VoiceQuality | null {
  const audio = config === null ? null : config['audio'];
  if (isRecord(audio) && isVoiceQuality(audio['quality'])) {
    return audio['quality'];
  }

  const fromId = MODEL_ID_PARTS.exec(id)?.[4];
  return isVoiceQuality(fromId) ? fromId : null;
}

function datasetOf(id: string, config: Record<string, unknown> | null): string {
  const declared = config === null ? null : readString(config, 'dataset');
  return declared ?? MODEL_ID_PARTS.exec(id)?.[3] ?? id;
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/u)
    .filter((word) => word !== '')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function languageName(
  language: VoiceLanguage,
  config: Record<string, unknown> | null,
): { readonly short: string; readonly spoken: string } {
  const declared = config === null ? null : config['language'];
  const nameEnglish = isRecord(declared) ? readString(declared, 'name_english') : null;
  const countryEnglish = isRecord(declared) ? readString(declared, 'country_english') : null;

  if (nameEnglish === null) {
    return { short: language.code, spoken: language.code };
  }

  if (countryEnglish === null) {
    return { short: nameEnglish, spoken: nameEnglish };
  }

  return {
    short: `${nameEnglish} (${countryEnglish})`,
    spoken: `${nameEnglish} as spoken in ${countryEnglish}`,
  };
}

function labelOf(
  dataset: string,
  language: VoiceLanguage,
  quality: VoiceQuality | null,
  config: Record<string, unknown> | null,
): string {
  const parts = [titleCase(dataset), languageName(language, config).short];
  if (quality !== null) {
    parts.push(QUALITY_LABELS[quality]);
  }
  return parts.join(' · ');
}

function descriptionOf(
  dataset: string,
  language: VoiceLanguage,
  config: Record<string, unknown> | null,
): string {
  if (config === null) {
    return `Derived from the model file name: this voice has no ${VOICE_MODEL_CONFIG_EXTENSION} metadata next to it.`;
  }

  const audio = config['audio'];
  const sampleRate = isRecord(audio) ? readNumber(audio, 'sample_rate') : null;
  const spoken = languageName(language, config).spoken;
  const trained = `Neural voice trained on the "${dataset}" dataset`;

  return sampleRate === null
    ? `${trained}. ${spoken}.`
    : `${trained}. ${spoken}, synthesized at ${sampleRate} Hz.`;
}

export function describeVoiceModel(fileName: string, config: unknown): Omit<VoiceModel, 'isDefault'> {
  const id = voiceModelId(fileName);
  const record = isRecord(config) ? config : null;
  const language = languageOf(id, record);
  const quality = qualityOf(id, record);
  const dataset = datasetOf(id, record);

  return {
    id,
    fileName,
    language,
    quality,
    label: labelOf(dataset, language, quality, record),
    description: descriptionOf(dataset, language, record),
  };
}

export function buildVoiceCatalog(
  files: readonly VoiceModelFile[],
  configuredModelPath: string,
): readonly VoiceModel[] {
  const defaultFileName = basename(configuredModelPath);

  return files
    .filter((file) => isVoiceModelFile(file.fileName))
    .map((file) => ({
      ...describeVoiceModel(file.fileName, file.config),
      isDefault: file.fileName === defaultFileName,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
