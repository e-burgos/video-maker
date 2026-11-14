import { artifactUrl } from '../../api/artifact-url';
import { assetFileName } from '../../api/asset-path';
import { assetRoleCopy } from '../../api/asset-roles';
import { useT } from '../../i18n/language-context';
import type { ViewerItem } from './viewer-model';

export type ViewerStageProps = {
  slug: string;
  item: ViewerItem;
  side: 'single' | 'left' | 'right';
};

const MEDIA_CLASS = 'absolute inset-0 size-full bg-[#0b0d14] object-contain';

function StageMedia({ slug, item }: { slug: string; item: ViewerItem }) {
  const t = useT();
  const src = artifactUrl(slug, item.path);

  if (item.kind === 'image') {
    return <img src={src} alt={item.path} className={MEDIA_CLASS} />;
  }
  if (item.kind === 'video') {
    return (
      <video
        key={src}
        src={src}
        controls
        preload="metadata"
        className={MEDIA_CLASS}
      />
    );
  }
  if (item.kind === 'audio') {
    return (
      <div className="absolute inset-0 grid place-items-center p-6">
        <audio
          key={src}
          src={src}
          controls
          preload="metadata"
          className="w-full max-w-md"
        />
      </div>
    );
  }
  return (
    <p className="absolute inset-0 grid place-items-center text-sm text-white/70">
      {t('viewer.stage.unsupported')}
    </p>
  );
}

export function ViewerStage({ slug, item, side }: ViewerStageProps) {
  const t = useT();

  return (
    <figure
      data-testid="viewer-stage"
      data-side={side}
      data-asset-path={item.path}
      className="relative m-0 min-h-[10rem] min-w-0 overflow-hidden rounded-[14px] border border-white/10 bg-[#0b0d14]"
    >
      <StageMedia slug={slug} item={item} />
      <figcaption className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-1rem)] items-center gap-2">
        <span className="font-data shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#0b0d14]">
          {t(assetRoleCopy(item.role).shortNameKey)}
        </span>
        <span className="font-data truncate rounded-md bg-black/75 px-2 py-0.5 text-[11px] text-white">
          {assetFileName(item.path)}
        </span>
      </figcaption>
    </figure>
  );
}
