import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ASSET_ROLES } from '../api/render-api-types';
import { useRenderApi } from '../api/render-api-context';
import { useAsyncResource } from '../hooks/use-async-resource';
import { AssetCard } from '../components/asset-card';
import { AssetUploader } from '../components/asset-uploader';
import { ErrorNotice } from '../components/error-notice';
import { MontageJobPanel } from '../components/montage-job-panel';
import { MontageTrigger } from '../components/montage-trigger';
import type { AssetListing, AssetRole } from '../api/render-api-types';

function assetsOfRole(listing: AssetListing, role: AssetRole) {
  return listing.assets.filter((asset) => asset.role === role);
}

export function AssetLibraryPage() {
  const client = useRenderApi();
  const navigate = useNavigate();
  const { slug = '' } = useParams<{ slug: string }>();
  const load = useCallback(() => client.listAssets(slug), [client, slug]);
  const listing = useAsyncResource<AssetListing>(load, `assets:${slug}`);
  const [montageJobId, setMontageJobId] = useState<string | null>(null);

  const openPreview = useCallback(() => {
    navigate(`/projects/${slug}/preview`);
  }, [navigate, slug]);

  return (
    <section className="space-y-6">
      <div>
        <Link to="/" className="text-xs text-slate-500 hover:text-slate-300">
          ← all projects
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{slug}</h1>
          <Link
            to={`/projects/${slug}/storyboard`}
            className="rounded-md border border-slate-700 px-3 py-1 font-mono text-xs text-slate-300 hover:border-slate-500"
          >
            open storyboard
          </Link>
          <Link
            to={`/projects/${slug}/voice`}
            className="rounded-md border border-slate-700 px-3 py-1 font-mono text-xs text-slate-300 hover:border-slate-500"
          >
            open voice
          </Link>
          <Link
            to={`/projects/${slug}/preview`}
            className="rounded-md border border-slate-700 px-3 py-1 font-mono text-xs text-slate-300 hover:border-slate-500"
          >
            open preview
          </Link>
        </div>
        {listing.status === 'ready' && listing.data !== null && (
          <p className="mt-1 text-sm text-slate-400">
            {listing.data.assets.length} raw assets · source{' '}
            <span data-testid="asset-source" className="font-mono text-slate-300">
              {listing.data.source}
            </span>
          </p>
        )}
      </div>

      <AssetUploader slug={slug} onUploaded={listing.reload} />

      <MontageTrigger slug={slug} onCreated={(job) => setMontageJobId(job.id)} />

      <MontageJobPanel jobId={montageJobId} onSucceeded={openPreview} />

      {listing.status === 'loading' && <p className="text-sm text-slate-500">Loading assets…</p>}
      {listing.status === 'error' && listing.error !== null && (
        <ErrorNotice error={listing.error} onRetry={listing.reload} />
      )}

      {listing.status === 'ready' && listing.data !== null && (
        <>
          {listing.data.probeFailures.length > 0 && (
            <div role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-200">Probe failures in the catalog</p>
              <ul className="mt-1 space-y-0.5 font-mono text-xs text-amber-100/80">
                {listing.data.probeFailures.map((failure) => (
                  <li key={failure.path}>
                    {failure.path} — {failure.errorCode}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ASSET_ROLES.map((role) => {
            const assets = assetsOfRole(listing.data as AssetListing, role);
            return (
              <div key={role} data-testid={`role-${role}`} className="space-y-3">
                <h2 className="font-mono text-sm uppercase tracking-wide text-slate-400">
                  {role} <span className="text-slate-600">({assets.length})</span>
                </h2>
                {assets.length === 0 ? (
                  <p className="text-sm text-slate-600">No {role} assets yet.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {assets.map((asset) => (
                      <AssetCard key={asset.path} slug={slug} asset={asset} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
