export const REFERENCE_RAW_DIRECTORY = 'raw/reference';
export const REFERENCE_WORK_DIRECTORY = 'work/reference';
export const REFERENCE_BRIEF_SUFFIX = '.brief.json';

export function referenceNameFor(file: string): string {
  const baseName = file.slice(file.lastIndexOf('/') + 1);
  const dotIndex = baseName.lastIndexOf('.');
  return dotIndex <= 0 ? baseName : baseName.slice(0, dotIndex);
}

export function referenceBriefPath(name: string): string {
  return `${REFERENCE_WORK_DIRECTORY}/${name}${REFERENCE_BRIEF_SUFFIX}`;
}

export function referenceKeyframesDirectory(name: string): string {
  return `${REFERENCE_WORK_DIRECTORY}/${name}`;
}

export function referenceKeyframePath(name: string, sceneIndex: number): string {
  return `${referenceKeyframesDirectory(name)}/scene-${String(sceneIndex).padStart(2, '0')}.jpg`;
}

export function referenceAudioPath(name: string): string {
  return `${REFERENCE_WORK_DIRECTORY}/${name}.wav`;
}

export function referenceWhisperOutBase(name: string): string {
  return `${REFERENCE_WORK_DIRECTORY}/${name}.whisper`;
}
