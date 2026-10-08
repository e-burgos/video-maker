import { describe, expect, it } from 'vitest';

import { composeFromStoryboard } from './compose-from-storyboard';
import { createFakePipelinePorts } from './__fixtures__/fake-pipeline-ports';
import { P, brand, brandFiles, storyboard } from './__fixtures__/pipeline-data';
import type { BrandManifest } from '../brand/brand-manifest';

const paletteBrand: BrandManifest = {
  ...brand,
  css: undefined,
  palette: { background: '#101820', accent: '#ff5500', accent2: '#00aaff', text: '#ffffff' },
  music: [],
};
const silent = { ...storyboard, music: null };

describe('composeFromStoryboard', () => {
  it('composes the template and script from the catalog and copies brand, music and images', async () => {
    const ports = createFakePipelinePorts({ files: { ...brandFiles(), '/in/images/local.jpg': 'jpg' } });
    const { lines } = await composeFromStoryboard(ports, storyboard, '/in', P);
    expect(lines[0]).toContain('2 scenes · 16:9 · music tema.mp3');
    expect(String(ports.files.get(`${P}/index.html.tpl`))).toContain('data-scene="hook"');
    const written = JSON.parse(String(ports.files.get(`${P}/script.json`)));
    expect(written.music).toEqual({ file: 'tema.mp3', credit: 'Tema · CC BY 4.0' });
    expect(written.scenes[1]).toMatchObject({ id: 'cierre', anchor: 10 });
    expect(ports.files.get(`${P}/assets/music/tema.mp3`)).toBe('mp3');
    expect(ports.files.get(`${P}/images/local.jpg`)).toBe('jpg');
    expect(ports.files.has(`${P}/storyboard.json`)).toBe(true);
  });

  it('fails on a missing image or an unknown brand', async () => {
    const missing = createFakePipelinePorts({ files: brandFiles() });
    await expect(composeFromStoryboard(missing, storyboard, '/in', P)).rejects.toThrow('image "images/local.jpg" not found');
    await expect(composeFromStoryboard(createFakePipelinePorts({}), storyboard, '/in', P)).rejects.toThrow('brand "acme" not found');
  });

  it('inside the project checks images in place and keeps the storyboard where it is', async () => {
    const silent = { ...storyboard, music: null };
    const ports = createFakePipelinePorts({ files: { ...brandFiles(), [`${P}/images/local.jpg`]: 'jpg' } });
    await composeFromStoryboard(ports, silent, P, P);
    expect(JSON.parse(String(ports.files.get(`${P}/script.json`))).music).toBeNull();
    expect(ports.files.has(`${P}/assets/music/tema.mp3`)).toBe(false);
    expect(ports.files.has(`${P}/storyboard.json`)).toBe(false);
    await expect(composeFromStoryboard(createFakePipelinePorts({ files: brandFiles() }), silent, P, P)).rejects.toThrow('not found in the project');
  });

  it('writes the stylesheet derived from the palette into the project when the brand has no css', async () => {
    const files = { '/repo/assets/runtime/gsap.min.js': 'gsap', '/repo/assets/brands/acme/brand.json': JSON.stringify(paletteBrand), [`${P}/images/local.jpg`]: 'jpg' };
    const ports = createFakePipelinePorts({ files });
    await composeFromStoryboard(ports, silent, P, P);
    const css = String(ports.files.get(`${P}/assets/brand/brand.css`));
    expect(css).toContain('--mg-accent: #ff5500;');
    expect(css).toContain('--mg-bg: #101820;');
    expect(String(ports.files.get(`${P}/index.html.tpl`))).toContain('assets/brand/brand.css');
  });

  it('appends the token overrides after the authored stylesheet', async () => {
    const withTokens: BrandManifest = { ...brand, tokens: { '--mg-radius': '4px' } };
    const files = { ...brandFiles(), '/repo/assets/brands/acme/brand.json': JSON.stringify(withTokens), '/repo/assets/brands/acme/brand.css': ':root { --mg-radius: 28px; }', [`${P}/images/local.jpg`]: 'jpg' };
    const ports = createFakePipelinePorts({ files });
    await composeFromStoryboard(ports, silent, P, P);
    const css = String(ports.files.get(`${P}/assets/brand/brand.css`));
    expect(css.indexOf('28px')).toBeLessThan(css.indexOf('4px'));
  });

  it('leaves the authored stylesheet untouched when the brand has no tokens', async () => {
    const ports = createFakePipelinePorts({ files: { ...brandFiles(), '/repo/assets/brands/acme/brand.css': 'authored', [`${P}/images/local.jpg`]: 'jpg' } });
    await composeFromStoryboard(ports, silent, P, P);
    expect(ports.files.get(`${P}/assets/brand/brand.css`)).toBe('authored');
  });

  it('prefers the user brands root and names both roots when the brand is nowhere', async () => {
    const userBrand: BrandManifest = { ...paletteBrand, name: 'Mine' };
    const files = { '/repo/assets/runtime/gsap.min.js': 'gsap', '/user/brands/acme/brand.json': JSON.stringify(userBrand), '/repo/assets/brands/acme/brand.json': JSON.stringify(brand), [`${P}/images/local.jpg`]: 'jpg' };
    const ports = { ...createFakePipelinePorts({ files }), userBrandsRoot: '/user/brands' };
    await composeFromStoryboard(ports, silent, P, P);
    expect(String(ports.files.get(`${P}/assets/brand/brand.css`))).toContain('--mg-accent: #ff5500;');
    const nowhere = { ...createFakePipelinePorts({}), userBrandsRoot: '/user/brands' };
    await expect(composeFromStoryboard(nowhere, silent, P, P)).rejects.toThrow('/user/brands nor in /repo/assets/brands');
  });
});
