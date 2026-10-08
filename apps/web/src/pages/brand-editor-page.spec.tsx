import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { brandDetail, brandManifest } from '../api/__fixtures__/brand';
import { RenderApiProvider } from '../api/render-api-context';
import { RenderApiError } from '../api/render-api-error';
import type { RenderApiClient } from '../api/render-api-client';
import type { BrandDetail, BrandManifest } from '../api/brand-types';
import { BrandEditorPage } from './brand-editor-page';

const PREVIEW = { url: '/brands/mine/preview/index.html', composedAt: '2026-10-08T10:00:00Z', durationSec: 9 };

function echoPut() {
  return vi.fn(async (_id: string, manifest: BrandManifest): Promise<BrandDetail> =>
    brandDetail({
      manifest,
      tokens: { '--mg-bg': manifest.palette?.background ?? '#000000', '--mg-accent': manifest.palette?.accent ?? '#000000' },
    }),
  );
}

function renderEditor(client: Partial<RenderApiClient>, id = 'mine') {
  const withDefaults: Partial<RenderApiClient> = {
    getBrand: vi.fn().mockResolvedValue(brandDetail()),
    composeBrandPreview: vi.fn().mockResolvedValue(PREVIEW),
    putBrand: echoPut(),
    listVoices: vi.fn().mockResolvedValue({ voices: [] }),
    ...client,
  };

  render(
    <RenderApiProvider client={withDefaults as RenderApiClient}>
      <MemoryRouter initialEntries={[`/brands/${id}`]}>
        <Routes>
          <Route path="/brands/:id" element={<BrandEditorPage />} />
          <Route path="/brands" element={<p>list</p>} />
        </Routes>
      </MemoryRouter>
    </RenderApiProvider>,
  );

  return withDefaults;
}

async function openSection(section: string) {
  await waitFor(() => expect(screen.getByTestId(`brand-nav-${section}`)).toBeTruthy());
  fireEvent.click(screen.getByTestId(`brand-nav-${section}`));
}

function file(name: string, type: string) {
  return new File(['bytes'], name, { type });
}

function lastPut(client: Partial<RenderApiClient>): BrandManifest {
  const calls = (client.putBrand as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1]?.[1] as BrandManifest;
}

describe('BrandEditorPage', () => {
  it('saves the identity section with a PUT of the full manifest', async () => {
    const client = renderEditor({});

    await waitFor(() => expect(screen.getByTestId('brand-section-identity')).toBeTruthy());
    expect((screen.getByTestId('brand-identity-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Spoken name'), { target: { value: 'Mine Pay' } });
    fireEvent.click(screen.getByTestId('brand-identity-save'));

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1));
    expect(lastPut(client)).toMatchObject({ id: 'mine', spokenName: 'Mine Pay', logo: 'img/logo.svg' });
    await waitFor(() => expect(screen.getByTestId('brand-save-status').textContent).toBe('Saved'));
  });

  it('recomposes the preview after saving the identity', async () => {
    const client = renderEditor({});

    await waitFor(() => expect(client.composeBrandPreview).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Otro eslogan' } });
    fireEvent.click(screen.getByTestId('brand-identity-save'));

    await waitFor(() => expect(client.composeBrandPreview).toHaveBeenCalledTimes(2));
  });

  it('blocks saving when a required identity field is empty', async () => {
    renderEditor({});

    await waitFor(() => expect(screen.getByTestId('brand-section-identity')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } });

    expect((screen.getByTestId('brand-identity-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('puts a color change debounced and posts the returned tokens to the preview without recomposing', async () => {
    const client = renderEditor({});
    const frame = (await screen.findByTestId('brand-preview-frame')) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow as Window, 'postMessage');
    await openSection('colors');

    fireEvent.change(screen.getByTestId('brand-color-accent-hex'), { target: { value: '#ff0000' } });
    expect(client.putBrand).not.toHaveBeenCalled();

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(lastPut(client).palette?.accent).toBe('#ff0000');
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { type: 'mg-brand-tokens', tokens: { '--mg-bg': '#09090b', '--mg-accent': '#ff0000' } },
        window.location.origin,
      ),
    );
    expect(client.composeBrandPreview).toHaveBeenCalledTimes(1);
  });

  it('collapses several quick color edits into one PUT', async () => {
    const client = renderEditor({});
    await openSection('colors');

    fireEvent.change(screen.getByTestId('brand-color-accent-hex'), { target: { value: '#111111' } });
    fireEvent.change(screen.getByTestId('brand-color-accent-hex'), { target: { value: '#222222' } });
    fireEvent.change(screen.getByTestId('brand-color-text-hex'), { target: { value: '#333333' } });

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(lastPut(client).palette).toMatchObject({ accent: '#222222', text: '#333333' });
  });

  it('lists every effective token and resets an override by removing it from the manifest', async () => {
    const manifest = brandManifest({ tokens: { '--mg-radius': '10px' } });
    const client = renderEditor({
      getBrand: vi.fn().mockResolvedValue(brandDetail({ manifest, tokens: { '--mg-bg': '#09090b', '--mg-radius': '10px' } })),
    });
    await openSection('colors');

    expect(screen.getByLabelText('--mg-bg')).toBeTruthy();
    expect(screen.queryByTestId('brand-token-reset---mg-bg')).toBeNull();
    fireEvent.click(screen.getByTestId('brand-token-reset---mg-radius'));

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect('tokens' in lastPut(client)).toBe(false);
  });

  it('writes a token override typed in the advanced list', async () => {
    const client = renderEditor({});
    await openSection('colors');

    const input = screen.getByLabelText('--mg-radius');
    fireEvent.change(input, { target: { value: '12px' } });
    fireEvent.blur(input);

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(lastPut(client).tokens).toEqual({ '--mg-radius': '12px' });
  });

  it('uploads a logo, points the manifest at it and recomposes the preview', async () => {
    const uploadBrandFile = vi.fn().mockResolvedValue({ path: 'img/nuevo.png' });
    const client = renderEditor({ uploadBrandFile });
    await openSection('logo');

    fireEvent.change(screen.getByTestId('brand-logo-upload'), { target: { files: [file('Nuevo.png', 'image/png')] } });

    await waitFor(() =>
      expect(uploadBrandFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'mine', kind: 'logo', filename: 'nuevo.png' })),
    );
    await waitFor(() => expect(lastPut(client).logo).toBe('img/nuevo.png'));
    await waitFor(() => expect(client.composeBrandPreview).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('brand-logo-on-dark')).toBeTruthy();
    expect(screen.getByTestId('brand-logo-on-light')).toBeTruthy();
  });

  it('adds a Google font through the fonts endpoint and recomposes', async () => {
    const withPoppins = brandDetail({
      manifest: brandManifest({
        fonts: [
          { family: 'Outfit', file: 'fonts/outfit.woff2' },
          { family: 'Poppins', file: 'fonts/poppins.woff2' },
        ],
      }),
    });
    const addBrandGoogleFont = vi.fn().mockResolvedValue(withPoppins);
    const client = renderEditor({ addBrandGoogleFont });
    await openSection('typography');

    fireEvent.change(screen.getByTestId('brand-google-font-family'), { target: { value: 'poppins' } });
    fireEvent.click(screen.getByTestId('brand-google-font-add'));

    await waitFor(() => expect(addBrandGoogleFont).toHaveBeenCalledWith('mine', 'poppins'));
    await waitFor(() => expect(client.composeBrandPreview).toHaveBeenCalledTimes(2));
    const options = within(screen.getByTestId('brand-typography-display')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Outfit', 'Poppins']);
    expect(client.putBrand).not.toHaveBeenCalled();
  });

  it('shows the Google font failure with its code', async () => {
    const addBrandGoogleFont = vi.fn().mockRejectedValue(new RenderApiError('BRAND_FONT_UNKNOWN', 'no family', 422, null));
    renderEditor({ addBrandGoogleFont });
    await openSection('typography');

    fireEvent.change(screen.getByTestId('brand-google-font-family'), { target: { value: 'Nope' } });
    fireEvent.click(screen.getByTestId('brand-google-font-add'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('BRAND_FONT_UNKNOWN'));
  });

  it('saves the chosen typography and keeps the weight and unicode range of the fonts', async () => {
    const manifest = brandManifest({
      fonts: [
        { family: 'Outfit', file: 'fonts/outfit.woff2', weight: '100 900', unicodeRange: 'U+0000-00FF' },
        { family: 'Geist', file: 'fonts/geist.woff2' },
      ],
    });
    const client = renderEditor({ getBrand: vi.fn().mockResolvedValue(brandDetail({ manifest })) });
    await openSection('typography');

    fireEvent.change(screen.getByTestId('brand-typography-body'), { target: { value: 'Geist' } });
    fireEvent.click(screen.getByTestId('brand-typography-save'));

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1));
    expect(lastPut(client).typography).toEqual({ display: 'Outfit', body: 'Geist' });
    expect(lastPut(client).fonts).toEqual(manifest.fonts);
  });

  it('uploads a font with its family name and adds it to the manifest', async () => {
    const uploadBrandFile = vi.fn().mockResolvedValue({ path: 'fonts/mi-fuente.woff2' });
    const client = renderEditor({ uploadBrandFile });
    await openSection('typography');

    fireEvent.change(screen.getByTestId('brand-font-upload-family'), { target: { value: 'Mi Fuente' } });
    fireEvent.change(screen.getByTestId('brand-font-upload-file'), {
      target: { files: [file('mi fuente.woff2', 'font/woff2')] },
    });

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1));
    expect(lastPut(client).fonts).toContainEqual({ family: 'Mi Fuente', file: 'fonts/mi-fuente.woff2' });
  });

  it('saves the voice and its speed', async () => {
    const client = renderEditor({});
    await openSection('voice');

    fireEvent.change(screen.getByTestId('brand-voice-speed'), { target: { value: '1.2' } });
    fireEvent.click(screen.getByTestId('brand-voice-save'));

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1));
    expect(lastPut(client).voice).toEqual({ id: 'es_AR-daniela-high', lengthScale: 1.2 });
    expect(client.composeBrandPreview).toHaveBeenCalledTimes(1);
  });

  it('uploads a track, requires its credit and then saves it', async () => {
    const uploadBrandFile = vi.fn().mockResolvedValue({ path: 'music/tema-uno.mp3' });
    const client = renderEditor({ uploadBrandFile });
    await openSection('music');

    fireEvent.change(screen.getByTestId('brand-music-upload'), { target: { files: [file('Tema Uno.mp3', 'audio/mpeg')] } });

    await waitFor(() => expect(screen.getByTestId('brand-track-tema-uno')).toBeTruthy());
    expect(uploadBrandFile).toHaveBeenCalledWith(expect.objectContaining({ kind: 'music', filename: 'tema-uno.mp3' }));
    expect((screen.getByTestId('brand-music-save') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId('brand-track-credit-tema-uno'), { target: { value: 'Autor - CC BY 4.0' } });
    fireEvent.change(screen.getByTestId('brand-track-mood-tema-uno'), { target: { value: 'upbeat' } });
    fireEvent.change(screen.getByTestId('brand-track-bpm-tema-uno'), { target: { value: '128' } });
    fireEvent.change(screen.getByTestId('brand-track-drop-tema-uno'), { target: { value: '8.5' } });
    fireEvent.click(screen.getByTestId('brand-music-save'));

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1));
    expect(lastPut(client).music).toEqual([
      { id: 'tema-uno', file: 'music/tema-uno.mp3', credit: 'Autor - CC BY 4.0', bpm: 128, mood: 'upbeat', drop: 8.5 },
    ]);
  });

  it('removes a track from the manifest', async () => {
    const manifest = brandManifest({
      music: [{ id: 'a', file: 'music/a.mp3', credit: 'x', bpm: 100, mood: 'calm' }],
    });
    const client = renderEditor({ getBrand: vi.fn().mockResolvedValue(brandDetail({ manifest })) });
    await openSection('music');

    expect(document.querySelector('audio')?.getAttribute('src')).toBe('/api/brands/mine/files/music/a.mp3');
    fireEvent.click(screen.getByTestId('brand-track-remove-a'));
    fireEvent.click(screen.getByTestId('brand-music-save'));

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1));
    expect(lastPut(client).music).toEqual([]);
  });

  it('uploads a photo under the image kind and requires its description', async () => {
    const uploadBrandFile = vi.fn().mockResolvedValue({ path: 'img/scenes/cafe-1.jpg' });
    const client = renderEditor({ uploadBrandFile });
    await openSection('photos');

    fireEvent.change(screen.getByTestId('brand-photo-upload'), { target: { files: [file('Café 1.jpg', 'image/jpeg')] } });

    await waitFor(() => expect(screen.getByTestId('brand-photo-cafe-1')).toBeTruthy());
    expect(uploadBrandFile).toHaveBeenCalledWith(expect.objectContaining({ kind: 'image', filename: 'cafe-1.jpg' }));
    expect((screen.getByTestId('brand-photos-save') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId('brand-photo-caption-cafe-1'), { target: { value: 'Una cafetería con mesas' } });
    fireEvent.click(screen.getByTestId('brand-photos-save'));

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1));
    expect(lastPut(client).images).toEqual({
      'cafe-1': { file: 'img/scenes/cafe-1.jpg', caption: 'Una cafetería con mesas' },
    });
  });

  it('turns four clicks on a product photo into four percentage points and stores them', async () => {
    const uploadBrandFile = vi.fn().mockResolvedValue({ path: 'img/devices/pos.png' });
    const client = renderEditor({ uploadBrandFile });
    await openSection('devices');

    fireEvent.change(screen.getByTestId('brand-device-upload'), { target: { files: [file('pos.png', 'image/png')] } });
    await waitFor(() => expect(screen.getByTestId('brand-device-pos')).toBeTruthy());
    expect((screen.getByTestId('brand-devices-save') as HTMLButtonElement).disabled).toBe(true);

    const surface = screen.getByTestId('brand-corner-surface');
    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    for (const [x, y] of [[20, 10], [180, 10], [180, 90], [20, 90]] as const) {
      fireEvent.click(surface, { clientX: x, clientY: y });
    }

    await waitFor(() => expect(screen.getByTestId('brand-corner-point-3')).toBeTruthy());
    fireEvent.change(screen.getByTestId('brand-device-name-pos'), { target: { value: 'POS' } });
    fireEvent.click(screen.getByTestId('brand-devices-save'));

    await waitFor(() => expect(client.putBrand).toHaveBeenCalledTimes(1));
    expect(lastPut(client).devices['pos']).toEqual({
      name: 'POS',
      image: 'img/devices/pos.png',
      kind: 'screen',
      screen: { polygon: [[10, 10], [90, 10], [90, 90], [10, 90]] },
    });
  });

  it('lets the corners be reset and picked again', async () => {
    const manifest = brandManifest({
      devices: {
        pos: {
          name: 'POS',
          image: 'img/devices/pos.png',
          kind: 'screen',
          screen: { polygon: [[1, 1], [2, 1], [2, 2], [1, 2]] },
        },
      },
    });
    renderEditor({ getBrand: vi.fn().mockResolvedValue(brandDetail({ manifest })) });
    await openSection('devices');

    expect(screen.getByTestId('brand-corner-point-3')).toBeTruthy();
    fireEvent.click(screen.getByTestId('brand-corner-reset'));

    expect(screen.queryByTestId('brand-corner-point-0')).toBeNull();
    expect((screen.getByTestId('brand-devices-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows an included brand read-only with a banner and a duplicate action', async () => {
    const createBrand = vi.fn().mockResolvedValue(brandDetail({ manifest: brandManifest({ id: 'copia' }) }));
    const client = renderEditor({
      getBrand: vi.fn().mockResolvedValue(brandDetail({ source: 'built-in' })),
      createBrand,
    });

    await waitFor(() => expect(screen.getByTestId('brand-readonly-banner')).toBeTruthy());
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('brand-identity-save') as HTMLButtonElement).disabled).toBe(true);
    await openSection('colors');
    expect((screen.getByTestId('brand-color-accent-hex') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByTestId('brand-logo-upload')).toBeNull();

    fireEvent.click(screen.getByTestId('brand-readonly-duplicate'));
    fireEvent.change(screen.getByTestId('brand-duplicate-modal-name'), { target: { value: 'Copia' } });
    fireEvent.click(screen.getByTestId('brand-duplicate-modal-submit'));

    await waitFor(() => expect(createBrand).toHaveBeenCalledWith({ name: 'Copia', duplicateFrom: 'mine' }));
    expect(client.putBrand).not.toHaveBeenCalled();
  });

  it('recomposes the preview from the refresh button', async () => {
    const client = renderEditor({});

    await waitFor(() => expect(client.composeBrandPreview).toHaveBeenCalledTimes(1));
    const frame = (await screen.findByTestId('brand-preview-frame')) as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toBe(
      '/api/brands/mine/preview/index.html?t=2026-10-08T10%3A00%3A00Z',
    );
    fireEvent.click(screen.getByTestId('brand-preview-refresh'));

    await waitFor(() => expect(client.composeBrandPreview).toHaveBeenCalledTimes(2));
  });

  it('shows the save failure with its code', async () => {
    const putBrand = vi.fn().mockRejectedValue(new RenderApiError('BRAND_MANIFEST_INVALID', 'bad', 422, null));
    renderEditor({ putBrand });

    await waitFor(() => expect(screen.getByTestId('brand-section-identity')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('brand-identity-save'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('BRAND_MANIFEST_INVALID'));
    expect(screen.getByTestId('brand-save-status').textContent).toBe('Could not save');
  });

  it('explains a brand that does not exist', async () => {
    renderEditor({ getBrand: vi.fn().mockRejectedValue(new RenderApiError('BRAND_UNKNOWN', 'nope', 404, null)) });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('BRAND_UNKNOWN'));
  });
});
