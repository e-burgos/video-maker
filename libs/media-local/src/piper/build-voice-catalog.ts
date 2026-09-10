import { basename } from 'node:path';

export const VOICE_MODEL_EXTENSION = '.onnx';

export interface VoiceModel {
  readonly id: string;
  readonly fileName: string;
  readonly isDefault: boolean;
}

function isVoiceModelFile(fileName: string): boolean {
  return fileName.endsWith(VOICE_MODEL_EXTENSION) && fileName.length > VOICE_MODEL_EXTENSION.length;
}

export function voiceModelId(fileName: string): string {
  return fileName.slice(0, -VOICE_MODEL_EXTENSION.length);
}

export function buildVoiceCatalog(
  fileNames: readonly string[],
  configuredModelPath: string,
): readonly VoiceModel[] {
  const defaultFileName = basename(configuredModelPath);

  return fileNames
    .filter(isVoiceModelFile)
    .map((fileName) => ({
      id: voiceModelId(fileName),
      fileName,
      isDefault: fileName === defaultFileName,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
