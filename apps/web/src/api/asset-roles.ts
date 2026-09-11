import { ASSET_ROLES } from './render-api-types';
import type { AssetRole } from './render-api-types';

export type AssetRoleCopy = {
  role: AssetRole;
  name: string;
  impact: string;
  required: boolean;
};

export const BROLL_MATCHING_HINT =
  'B-roll clips and images are shown when their file name matches a word said at least three times in the script, so name them after what they show.';

const COPY: Readonly<Record<AssetRole, AssetRoleCopy>> = {
  aroll: {
    role: 'aroll',
    name: 'A-roll · main footage',
    impact:
      'The takes you speak in. Their speech is transcribed, drives every cut and every caption, and sets how long the video lasts.',
    required: true,
  },
  broll: {
    role: 'broll',
    name: 'B-roll · supporting clips',
    impact:
      'Silent clips laid over the A-roll while you keep talking. One is used when its file name matches a word the script repeats at least three times.',
    required: false,
  },
  image: {
    role: 'image',
    name: 'Images · supporting photos',
    impact:
      'Photos matched by file name like B-roll, animated with a slow Ken Burns move or shown as a picture-in-picture, depending on the output preset.',
    required: false,
  },
  audio: {
    role: 'audio',
    name: 'Music · background bed',
    impact:
      'The bed under the whole video. It is ducked automatically whenever someone speaks, so make it longer than the edit.',
    required: false,
  },
  voice: {
    role: 'voice',
    name: 'Voice-over · your own recording',
    impact:
      'A narration you recorded yourself. It replaces the synthesized voice of a scene, or becomes the speech the montage is cut against.',
    required: false,
  },
  logo: {
    role: 'logo',
    name: 'Logo · overlay',
    impact:
      'A PNG with transparency drawn on top of the finished video, bottom right by default. Turn it on and place it from the preview page.',
    required: false,
  },
};

const IMPORTANCE: readonly AssetRole[] = ['aroll', 'broll', 'image', 'audio', 'voice', 'logo'];

export function assetRoleCopy(role: AssetRole): AssetRoleCopy {
  return COPY[role];
}

export function orderedAssetRoles(
  offered: readonly AssetRole[] = ASSET_ROLES,
): readonly AssetRoleCopy[] {
  return IMPORTANCE.filter((role) => offered.includes(role)).map(assetRoleCopy);
}
