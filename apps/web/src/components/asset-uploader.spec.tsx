import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AssetUploader } from './asset-uploader';
import { RenderApiError } from '../api/render-api-error';
import { RenderApiProvider } from '../api/render-api-context';
import type { RenderApiClient } from '../api/render-api-client';

function renderUploader(uploadAsset: RenderApiClient['uploadAsset'], onUploaded = vi.fn()) {
  render(
    <RenderApiProvider client={{ uploadAsset } as unknown as RenderApiClient}>
      <AssetUploader slug="smoke-ingest" onUploaded={onUploaded} />
    </RenderApiProvider>,
  );
  return onUploaded;
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('Asset file'), { target: { files: [file] } });
}

describe('AssetUploader', () => {
  it('sends the file as a raw binary body to the selected role', async () => {
    const uploadAsset = vi.fn().mockResolvedValue({ path: 'raw/broll/clip02.mp4' });
    const onUploaded = renderUploader(uploadAsset as unknown as RenderApiClient['uploadAsset']);

    fireEvent.click(screen.getByLabelText('Upload to B-roll · supporting clips'));
    const file = new File(['bytes'], 'clip02.mp4', { type: 'video/mp4' });
    chooseFile(file);

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(uploadAsset).toHaveBeenCalledWith({
      slug: 'smoke-ingest',
      role: 'broll',
      filename: 'clip02.mp4',
      contentType: 'video/mp4',
      body: file,
    });
    expect(screen.getByRole('status').textContent).toContain('raw/broll/clip02.mp4');
  });

  it('derives the content type from the extension when the browser reports none', async () => {
    const uploadAsset = vi.fn().mockResolvedValue({ path: 'raw/audio/music02.mp3' });
    renderUploader(uploadAsset as unknown as RenderApiClient['uploadAsset']);

    chooseFile(new File(['bytes'], 'music02.mp3', { type: '' }));

    await waitFor(() => expect(uploadAsset).toHaveBeenCalledTimes(1));
    expect(uploadAsset.mock.calls[0]?.[0].contentType).toBe('audio/mpeg');
  });

  it('shows the service code and never reports an upload when the service rejects it', async () => {
    const uploadAsset = vi
      .fn()
      .mockRejectedValue(new RenderApiError('ASSET_ALREADY_EXISTS', 'Already there.', 409, null));
    const onUploaded = renderUploader(uploadAsset as unknown as RenderApiClient['uploadAsset']);

    chooseFile(new File(['bytes'], 'clip01.mp4', { type: 'video/mp4' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('ASSET_ALREADY_EXISTS'),
    );
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('wraps a transport failure in the transport surface', async () => {
    const uploadAsset = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    renderUploader(uploadAsset as unknown as RenderApiClient['uploadAsset']);

    chooseFile(new File(['bytes'], 'clip01.mp4', { type: 'video/mp4' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('SERVICE_UNREACHABLE'),
    );
  });

  it('ignores a change event that carries no file', () => {
    const uploadAsset = vi.fn();
    renderUploader(uploadAsset as unknown as RenderApiClient['uploadAsset']);

    fireEvent.change(screen.getByLabelText('Asset file'), { target: { files: [] } });

    expect(uploadAsset).not.toHaveBeenCalled();
  });
});

describe('AssetUploader pinned to a single role', () => {
  it('drops the selector, states the role and hands the stored entry back to the caller', async () => {
    const uploadAsset = vi.fn().mockResolvedValue({ path: 'raw/voice/take-03.wav', role: 'voice' });
    const onUploaded = vi.fn();

    render(
      <RenderApiProvider client={{ uploadAsset } as unknown as RenderApiClient}>
        <AssetUploader
          slug="smoke-ingest"
          roles={['voice']}
          fileInputLabel="Upload a take for scene-03"
          onUploaded={onUploaded}
        />
      </RenderApiProvider>,
    );

    expect(screen.queryByTestId('asset-role-choices')).toBeNull();
    expect(screen.getByText('voice')).toBeDefined();

    const file = new File(['bytes'], 'take-03.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Upload a take for scene-03'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(uploadAsset).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'voice', filename: 'take-03.wav', contentType: 'audio/wav' }),
    );
    expect(onUploaded).toHaveBeenCalledWith({ path: 'raw/voice/take-03.wav', role: 'voice' });
  });

  it('gives each instance its own field ids so several cards can coexist', () => {
    const uploadAsset = vi.fn();

    render(
      <RenderApiProvider client={{ uploadAsset } as unknown as RenderApiClient}>
        <AssetUploader slug="s" roles={['voice']} fileInputLabel="one" onUploaded={vi.fn()} />
        <AssetUploader slug="s" roles={['voice']} fileInputLabel="two" onUploaded={vi.fn()} />
      </RenderApiProvider>,
    );

    const first = screen.getByLabelText('one') as HTMLInputElement;
    const second = screen.getByLabelText('two') as HTMLInputElement;
    expect(first.id).not.toBe(second.id);
  });
});

describe('AssetUploader role descriptions (US-016-004)', () => {
  it('shows every role with a readable name and what it does to the final video', () => {
    renderUploader(vi.fn() as unknown as RenderApiClient['uploadAsset']);

    const choices = screen.getAllByTestId('asset-role-choice');
    expect(choices.map((choice) => choice.dataset['role'])).toEqual([
      'aroll',
      'broll',
      'image',
      'audio',
      'voice',
      'logo',
      'reference',
    ]);
    expect(choices[0]?.textContent).toContain('A-roll · main footage');
    expect(choices[0]?.textContent).toContain('sets how long the video lasts');
    expect(choices[3]?.textContent).toContain('ducked automatically');
  });

  it('marks A-roll as required and starts selected on it', () => {
    renderUploader(vi.fn() as unknown as RenderApiClient['uploadAsset']);

    const required = screen.getAllByTestId('asset-role-required');
    expect(required).toHaveLength(1);
    const selected = screen
      .getAllByTestId('asset-role-choice')
      .filter((choice) => choice.dataset['selected'] === 'true');
    expect(selected.map((choice) => choice.dataset['role'])).toEqual(['aroll']);
  });

  it('states the rule that decides when a B-roll clip is actually used', () => {
    renderUploader(vi.fn() as unknown as RenderApiClient['uploadAsset']);

    expect(screen.getByTestId('asset-role-hint').textContent).toContain('at least three times');
  });

  it('names the directory each role lands in, so the copy matches what the disk shows', () => {
    renderUploader(vi.fn() as unknown as RenderApiClient['uploadAsset']);

    expect(screen.getAllByTestId('asset-role-choice')[5]?.textContent).toContain('raw/logo/');
  });

  it('explains the fixed role too when the uploader is pinned to one', () => {
    render(
      <RenderApiProvider client={{ uploadAsset: vi.fn() } as unknown as RenderApiClient}>
        <AssetUploader slug="s" roles={['logo']} onUploaded={vi.fn()} />
      </RenderApiProvider>,
    );

    expect(screen.queryByTestId('asset-role-hint')).toBeNull();
    expect(screen.getByText(/PNG with transparency/)).toBeDefined();
  });
});
