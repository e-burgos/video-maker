import type { BrandEditor } from '../../hooks/use-brand-editor';
import { BrandColorsSection } from './brand-colors-section';
import { BrandDevicesSection } from './brand-devices-section';
import { BrandIdentitySection } from './brand-identity-section';
import { BrandLogoSection } from './brand-logo-section';
import { BrandMusicSection } from './brand-music-section';
import { BrandPhotosSection } from './brand-photos-section';
import type { BrandSectionId } from './brand-sections';
import { BrandTypographySection } from './brand-typography-section';
import { BrandVoiceSection } from './brand-voice-section';
import type { BrandDraft } from './use-brand-draft';

export type BrandSectionBodyProps = { id: BrandSectionId; editor: BrandEditor; draft: BrandDraft };

export function BrandSectionBody({ id, editor, draft }: BrandSectionBodyProps) {
  switch (id) {
    case 'identity':
      return <BrandIdentitySection editor={editor} draft={draft.identity} />;
    case 'logo':
      return <BrandLogoSection editor={editor} />;
    case 'colors':
      return <BrandColorsSection editor={editor} />;
    case 'typography':
      return <BrandTypographySection editor={editor} draft={draft.typography} />;
    case 'voice':
      return <BrandVoiceSection editor={editor} draft={draft.voice} />;
    case 'music':
      return <BrandMusicSection editor={editor} draft={draft.music} />;
    case 'photos':
      return <BrandPhotosSection editor={editor} draft={draft.photos} />;
    case 'devices':
      return <BrandDevicesSection editor={editor} draft={draft.devices} />;
  }
}
