import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssetCard } from './asset-card';
import type { AssetListEntry } from '../api/render-api-types';

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
    render(<AssetCard slug="smoke-ingest" asset={videoAsset} />);

    const video = screen.getByTestId('asset-preview-video');
    expect(video.getAttribute('src')).toBe('/api/projects/smoke-ingest/files/raw/aroll/clip01.mp4');
    expect(video.hasAttribute('controls')).toBe(true);
  });

  it('shows the size and the probed media facts', () => {
    render(<AssetCard slug="smoke-ingest" asset={videoAsset} />);

    expect(screen.getByText('201.2 kB · video · 1280×720 · 0:23 · 30 fps · aac 1ch')).toBeTruthy();
  });

  it('shows an image asset without a duration', () => {
    render(
      <AssetCard
        slug="smoke-ingest"
        asset={{
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
        }}
      />,
    );

    expect(screen.getByTestId('asset-preview-image').getAttribute('src')).toBe(
      '/api/projects/smoke-ingest/files/raw/images/photo01.jpg',
    );
    expect(screen.getByText('5.5 kB · image · 1280×720')).toBeTruthy();
  });

  it('plays an audio asset and says when an asset was never probed', () => {
    render(
      <AssetCard
        slug="smoke-ingest"
        asset={{
          path: 'raw/audio/music01.mp3',
          role: 'audio',
          fingerprint: { sizeBytes: 644116, modifiedAtMs: 1 },
          media: null,
        }}
      />,
    );

    expect(screen.getByTestId('asset-preview-audio').getAttribute('src')).toBe(
      '/api/projects/smoke-ingest/files/raw/audio/music01.mp3',
    );
    expect(screen.getByText('629.0 kB · not probed')).toBeTruthy();
  });

  it('offers a download link for an extension the browser cannot render', () => {
    render(
      <AssetCard
        slug="smoke-ingest"
        asset={{
          path: 'raw/broll/notes.txt',
          role: 'broll',
          fingerprint: { sizeBytes: 12, modifiedAtMs: 1 },
          media: null,
        }}
      />,
    );

    expect(screen.getByTestId('asset-preview-download').getAttribute('href')).toBe(
      '/api/projects/smoke-ingest/files/raw/broll/notes.txt',
    );
  });
});
