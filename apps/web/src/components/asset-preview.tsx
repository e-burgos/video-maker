import { artifactUrl } from '../api/artifact-url';
import { assetMediaKind } from '../api/asset-media-kind';

export type AssetPreviewProps = {
  slug: string;
  path: string;
};

export function AssetPreview({ slug, path }: AssetPreviewProps) {
  const src = artifactUrl(slug, path);
  const kind = assetMediaKind(path);

  if (kind === 'video') {
    return (
      <video
        data-testid="asset-preview-video"
        src={src}
        controls
        preload="metadata"
        className="aspect-video w-full rounded-md bg-black"
      />
    );
  }

  if (kind === 'image') {
    return (
      <img
        data-testid="asset-preview-image"
        src={src}
        alt={path}
        className="aspect-video w-full rounded-md bg-black object-contain"
      />
    );
  }

  if (kind === 'audio') {
    return <audio data-testid="asset-preview-audio" src={src} controls preload="metadata" className="w-full" />;
  }

  return (
    <a
      data-testid="asset-preview-download"
      href={src}
      className="inline-block font-mono text-xs text-sky-300 underline"
    >
      download
    </a>
  );
}
