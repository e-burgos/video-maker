import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ASSET_ROLES } from '../api/render-api-types';
import { assetFileName } from '../api/asset-path';
import { useRenderApi } from '../api/render-api-context';
import { primaryAssetRole } from '../api/workspace-panel';
import { useAsyncResource } from '../hooks/use-async-resource';
import { useT, useTn } from '../i18n/language-context';
import { AssetUploader } from '../components/asset-uploader';
import { ProjectModeGate } from '../components/project-mode-gate';
import { ErrorNotice } from '../components/error-notice';
import { GeneratedFilesPanel } from '../components/generated-files-panel';
import { AssetDeleteDialog } from '../components/library/asset-delete-dialog';
import { LibraryFilterBar } from '../components/library/library-filter-bar';
import { LibraryGrid } from '../components/library/library-grid';
import {
  filterAssets,
  filterableRoles,
  flaggedAssetPaths,
  orderAssetsByRole,
  pruneSelection,
  reviewByAssetPath,
  roleSummary,
  toggleSelection,
} from '../components/library/library-model';
import { RoleSummary } from '../components/library/role-summary';
import { SelectionBar } from '../components/library/selection-bar';
import { useUploaderFocus } from '../components/library/use-uploader-focus';
import { MediaViewer } from '../components/media-viewer/media-viewer';
import { viewerItemOf } from '../components/media-viewer/viewer-model';
import { MontageJobPanel } from '../components/montage-job-panel';
import { MontageTrigger } from '../components/montage-trigger';
import { ReferenceAnalysis } from '../components/reference-analysis';
import { useToolbarAction } from '../components/shell/use-toolbar-action';
import { SECONDARY_BUTTON_SMALL_CLASS } from '../components/ui/cl-controls';
import type { TranslationKey } from '../i18n/messages-en';
import type { DeleteTarget } from '../components/library/asset-delete-dialog';
import type {
  RoleFilter,
  ThumbnailSize,
} from '../components/library/library-model';
import type {
  AssetListEntry,
  AssetListing,
  AssetRole,
  ProjectMode,
} from '../api/render-api-types';

const MOTION_UPLOAD_ROLES: readonly AssetRole[] = ['image'];
const MOTION_REFERENCE_ROLES: readonly AssetRole[] = ['reference'];
const MOTION_LIBRARY_ROLES: readonly AssetRole[] = [
  ...MOTION_UPLOAD_ROLES,
  ...MOTION_REFERENCE_ROLES,
];

const STEP_LINKS: readonly { step: string; labelKey: TranslationKey }[] = [
  { step: 'storyboard', labelKey: 'library.openStoryboard' },
  { step: 'voice', labelKey: 'library.openVoice' },
  { step: 'preview', labelKey: 'library.openPreview' },
];

type ViewerRequest = {
  startPath: string;
  compare: boolean;
  trigger: HTMLElement | null;
};

function AssetLibraryContent({ mode }: { mode: ProjectMode }) {
  const client = useRenderApi();
  const navigate = useNavigate();
  const { slug = '' } = useParams<{ slug: string }>();
  const load = useCallback(() => client.listAssets(slug), [client, slug]);
  const listing = useAsyncResource<AssetListing>(load, `assets:${slug}`);
  const loadReview = useCallback(async () => {
    try {
      return await client.getMaterialReview(slug);
    } catch {
      return null;
    }
  }, [client, slug]);
  const review = useAsyncResource(loadReview, `library-review:${slug}`);
  const [montageJobId, setMontageJobId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [size, setSize] = useState<ThumbnailSize>('m');
  const [selected, setSelected] = useState<string[]>([]);
  const [viewer, setViewer] = useState<ViewerRequest | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<
    readonly DeleteTarget[] | null
  >(null);
  const { container: uploaders, focusUploader } = useUploaderFocus();
  const t = useT();
  const tn = useTn();
  const isMotion = mode === 'motion';
  const roles = isMotion ? MOTION_LIBRARY_ROLES : ASSET_ROLES;

  const openPreview = useCallback(() => {
    navigate(`/projects/${slug}/preview`);
  }, [navigate, slug]);

  useToolbarAction({
    label: t('library.upload.action'),
    onClick: focusUploader,
  });

  const allAssets = useMemo(
    () => orderAssetsByRole(listing.data?.assets ?? [], roles),
    [listing.data, roles],
  );
  const filterRoles = useMemo(
    () => filterableRoles(allAssets, roles),
    [allAssets, roles],
  );
  const activeFilter: RoleFilter =
    filter === 'all' || filterRoles.includes(filter) ? filter : 'all';
  const visibleAssets = useMemo(
    () => filterAssets(allAssets, activeFilter),
    [allAssets, activeFilter],
  );
  const selectedPaths = useMemo(
    () => pruneSelection(selected, allAssets),
    [selected, allAssets],
  );
  const warnings = review.data?.warnings ?? null;
  const flagged = useMemo(() => flaggedAssetPaths(warnings), [warnings]);
  const reviewItems = useMemo(
    () => reviewByAssetPath(review.data?.review ?? null),
    [review.data],
  );
  const summary = useMemo(
    () => roleSummary(allAssets, roles, primaryAssetRole(isMotion), flagged),
    [allAssets, roles, isMotion, flagged],
  );
  const viewerItems = useMemo(
    () => visibleAssets.map(viewerItemOf),
    [visibleAssets],
  );
  const referenceAssets = allAssets.filter(
    (asset) => asset.role === 'reference',
  );

  function openViewer(
    path: string,
    trigger: HTMLElement | null,
    compare = false,
  ): void {
    setViewer({ startPath: path, compare, trigger });
  }

  function compareSelected(trigger: HTMLElement): void {
    const first = selectedPaths[0];
    if (selectedPaths.length !== 2 || first === undefined) {
      return;
    }
    setFilter('all');
    openViewer(first, trigger, true);
  }

  function deleteSelected(): void {
    const targets = allAssets
      .filter((asset) => selectedPaths.includes(asset.path))
      .map(toDeleteTarget);
    setDeleteTargets(targets);
  }

  return (
    <section data-testid="asset-library" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {STEP_LINKS.map((link) => (
          <Link
            key={link.step}
            to={`/projects/${slug}/${link.step}`}
            className={SECONDARY_BUTTON_SMALL_CLASS}
          >
            {t(link.labelKey)}
          </Link>
        ))}
        {listing.status === 'ready' && listing.data !== null && (
          <p className="m-0 text-xs text-[var(--cl-ink-2)]">
            {tn('library.assetCount', listing.data.assets.length)} ·{' '}
            {t('library.source')}{' '}
            <span
              data-testid="asset-source"
              className="font-data text-[var(--cl-ink)]"
            >
              {listing.data.source}
            </span>
          </p>
        )}
      </div>

      {listing.status === 'loading' && (
        <p className="m-0 text-sm text-[var(--cl-ink-2)]">
          {t('library.loading')}
        </p>
      )}
      {listing.status === 'error' && listing.error !== null && (
        <ErrorNotice
          surface="glass"
          error={listing.error}
          onRetry={listing.reload}
        />
      )}

      {listing.status === 'ready' && listing.data !== null && (
        <>
          <RoleSummary entries={summary} />

          {listing.data.probeFailures.length > 0 && (
            <div
              role="note"
              className="rounded-[12px] border border-[var(--tucu-state-orange-line)] bg-[var(--tucu-state-orange-soft)] p-3"
            >
              <p className="m-0 text-sm font-semibold text-[var(--tucu-state-orange-ink)]">
                {t('library.probeFailures')}
              </p>
              <ul className="font-data m-0 mt-1 list-none space-y-0.5 p-0 text-xs text-[var(--cl-ink)]">
                {listing.data.probeFailures.map((failure) => (
                  <li key={failure.path}>
                    {failure.path} — {failure.errorCode}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="glass space-y-3 rounded-[20px] p-4">
            <LibraryFilterBar
              total={allAssets.length}
              roles={filterRoles}
              filter={activeFilter}
              onFilterChange={setFilter}
              size={size}
              onSizeChange={setSize}
            />
            <LibraryGrid
              slug={slug}
              assets={visibleAssets}
              selected={selectedPaths}
              size={size}
              filtered={activeFilter !== 'all'}
              onToggleSelected={(path) =>
                setSelected((current) =>
                  toggleSelection(pruneSelection(current, allAssets), path),
                )
              }
              onOpen={(path, trigger) => openViewer(path, trigger)}
              onDelete={(asset) => setDeleteTargets([toDeleteTarget(asset)])}
              onUpload={focusUploader}
            />
          </section>
        </>
      )}

      <div ref={uploaders} className="flex flex-col gap-4">
        {isMotion ? (
          <>
            <AssetUploader
              slug={slug}
              roles={MOTION_UPLOAD_ROLES}
              fileInputLabel={t('motionLibrary.uploadLabel')}
              roleHint={t('motionLibrary.imageHint')}
              onUploaded={listing.reload}
            />
            <AssetUploader
              slug={slug}
              roles={MOTION_REFERENCE_ROLES}
              onUploaded={listing.reload}
            />
          </>
        ) : (
          <AssetUploader slug={slug} onUploaded={listing.reload} />
        )}
      </div>

      {!isMotion && (
        <>
          <MontageTrigger
            slug={slug}
            onCreated={(job) => setMontageJobId(job.id)}
          />
          <MontageJobPanel
            jobId={montageJobId}
            onSucceeded={openPreview}
            onRetried={(job) => setMontageJobId(job.id)}
          />
        </>
      )}

      {referenceAssets.length > 0 && (
        <section
          data-testid="library-references"
          className="glass space-y-3 rounded-[20px] p-4"
        >
          <h2 className="m-0 text-sm font-bold text-[var(--cl-ink)]">
            {t('library.references.heading')}
          </h2>
          {referenceAssets.map((asset) => (
            <div key={asset.path} className="space-y-2">
              <p
                className="font-data m-0 truncate text-xs font-semibold text-[var(--cl-ink)]"
                title={asset.path}
              >
                {assetFileName(asset.path)}
              </p>
              <ReferenceAnalysis slug={slug} assetPath={asset.path} />
            </div>
          ))}
        </section>
      )}

      {!isMotion && <GeneratedFilesPanel slug={slug} assets={listing.data} />}

      {selectedPaths.length > 0 && (
        <SelectionBar
          count={selectedPaths.length}
          onClear={() => setSelected([])}
          onCompare={compareSelected}
          onDelete={deleteSelected}
        />
      )}

      {viewer !== null && viewerItems.length > 0 && (
        <MediaViewer
          slug={slug}
          items={viewerItems}
          startPath={viewer.startPath}
          selectedPaths={selectedPaths}
          startCompare={viewer.compare}
          review={reviewItems}
          trigger={viewer.trigger}
          onClose={() => setViewer(null)}
        />
      )}

      {deleteTargets !== null && (
        <AssetDeleteDialog
          slug={slug}
          targets={deleteTargets}
          onDeleted={listing.reload}
          onClose={() => setDeleteTargets(null)}
        />
      )}
    </section>
  );
}

function toDeleteTarget(asset: AssetListEntry): DeleteTarget {
  return { role: asset.role, path: asset.path };
}

export function AssetLibraryPage() {
  const { slug = '' } = useParams<{ slug: string }>();

  return (
    <ProjectModeGate
      slug={slug}
      footage={<AssetLibraryContent mode="footage" />}
      motion={<AssetLibraryContent mode="motion" />}
    />
  );
}
