import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssetCard } from './asset-card';
import { RenderApiProvider } from '../api/render-api-context';
import type { RenderApiClient } from '../api/render-api-client';
import type { AssetListEntry } from '../api/render-api-types';

function renderCard(asset: AssetListEntry, client?: Partial<RenderApiClient>) {
  return render(
    <RenderApiProvider client={(client ?? {}) as RenderApiClient}>
      <ul>
        <AssetCard slug="smoke-ingest" asset={asset} onDeleted={vi.fn()} />
      </ul>
    </RenderApiProvider>,
  );
}

const videoAsset: AssetListEntry = {
  path: 'raw/aroll/clip01.mp4',
  role: 'aroll',
  fingerprint: { sizeBytes: 206060, modifiedAtMs: 1788876902053 },
  media: {
    id: 'raw/aroll/clip01.mp4',
    kind: 'video',
    path: 'raw/aroll/clip01.mp4',
    durationMs: 22500,
    fps: 30,
    width: 1280,
    height: 720,
    hasAudio: true,
    audio: { sampleRate: 16000, channels: 1, codec: 'aac' },
    videoCodec: 'h264',
    probedAt: '2026-09-08T15:45:12.322Z',
  },
};

describe('AssetCard', () => {
  it('plays a video asset from the service files endpoint', () => {
    renderCard(videoAsset);

    const video = screen.getByTestId('asset-preview-video');
    expect(video.getAttribute('src')).toBe('/api/projects/smoke-ingest/files/raw/aroll/clip01.mp4');
    expect(video.hasAttribute('controls')).toBe(true);
  });

  it('shows the size and the probed media facts', () => {
    renderCard(videoAsset);

    expect(screen.getByText('201.2 kB · video · 1280×720 · 0:23 · 30 fps · aac 1ch')).toBeTruthy();
  });

  it('shows an image asset without a duration', () => {
    renderCard({
      path: 'raw/images/photo01.jpg',
      role: 'image',
      fingerprint: { sizeBytes: 5621, modifiedAtMs: 1 },
      media: {
        id: 'raw/images/photo01.jpg',
        kind: 'image',
        path: 'raw/images/photo01.jpg',
        durationMs: 0,
        width: 1280,
        height: 720,
        hasAudio: false,
        probedAt: '2026-09-08T15:45:12.400Z',
      },
    });

    expect(screen.getByTestId('asset-preview-image').getAttribute('src')).toBe(
      '/api/projects/smoke-ingest/files/raw/images/photo01.jpg',
    );
    expect(screen.getByText('5.5 kB · image · 1280×720')).toBeTruthy();
  });

  it('plays an audio asset and says when an asset was never probed', () => {
    renderCard({
      path: 'raw/audio/music01.mp3',
      role: 'audio',
      fingerprint: { sizeBytes: 644116, modifiedAtMs: 1 },
      media: null,
    });

    expect(screen.getByTestId('asset-preview-audio').getAttribute('src')).toBe(
      '/api/projects/smoke-ingest/files/raw/audio/music01.mp3',
    );
    expect(screen.getByText('629.0 kB · not probed')).toBeTruthy();
  });

  it('offers a download link for an extension the browser cannot render', () => {
    renderCard({
      path: 'raw/broll/notes.txt',
      role: 'broll',
      fingerprint: { sizeBytes: 12, modifiedAtMs: 1 },
      media: null,
    });

    expect(screen.getByTestId('asset-preview-download').getAttribute('href')).toBe(
      '/api/projects/smoke-ingest/files/raw/broll/notes.txt',
    );
  });
});

describe('AssetCard deletion', () => {
  it('offers a delete control named after the file it would remove', () => {
    renderCard(videoAsset);

    expect(screen.getByTestId('asset-card').getAttribute('data-asset-path')).toBe(
      'raw/aroll/clip01.mp4',
    );

    const open = screen.getByTestId('asset-delete-open');
    expect(open.getAttribute('aria-label')).toBe('Delete clip01.mp4');
    expect(open.textContent).toBe('Delete');
  });

  it('offers the reference analysis only on reference assets', () => {
    const getReference = vi.fn().mockRejectedValue(new Error('pending'));
    renderCard({ ...videoAsset, role: 'reference', path: 'raw/reference/demo.mp4' }, { getReference });

    expect(screen.getByTestId('reference-analysis')).toBeTruthy();
  });

  it('does not show the reference analysis on other roles', () => {
    renderCard(videoAsset);

    expect(screen.queryByTestId('reference-analysis')).toBeNull();
  });
});
