import { describe, expect, it } from 'vitest';

import { initFromTemplate } from './init-from-template';
import { joinPath } from './join-path';
import { createFakePipelinePorts } from './__fixtures__/fake-pipeline-ports';
import { P, script } from './__fixtures__/pipeline-data';

describe('initFromTemplate', () => {
  it('copies the shared runtime, the brand kit, the hand template and its music into the project', async () => {
    const ports = createFakePipelinePorts({
      files: {
        '/repo/assets/runtime/gsap.min.js': 'gsap',
        '/repo/assets/brands/acme/brand.json': '{}',
        '/repo/assets/brands/acme/music/tema.mp3': 'mp3',
        '/repo/templates/acme/_brand/brand/kit.css': 'css',
        '/repo/templates/acme/promo/script.json': JSON.stringify(script),
        '/repo/templates/acme/promo/index.html.tpl': 'tpl',
      },
    });
    const { lines } = await initFromTemplate(ports, '/repo/templates', 'acme/promo', P);
    expect(lines).toEqual([`init: acme/promo → ${P}`]);
    expect(ports.files.get(`${P}/assets/runtime/gsap.min.js`)).toBe('gsap');
    expect(ports.files.get(`${P}/assets/brand/kit.css`)).toBe('css');
    expect(ports.files.get(`${P}/index.html.tpl`)).toBe('tpl');
    expect(ports.files.get(`${P}/assets/music/tema.mp3`)).toBe('mp3');
  });

  it('rejects an unknown template or a missing video name', async () => {
    const ports = createFakePipelinePorts({});
    await expect(initFromTemplate(ports, '/repo/templates', 'acme/nope', P)).rejects.toThrow('template acme/nope not found');
    await expect(initFromTemplate(ports, '/repo/templates', 'acme', P)).rejects.toThrow('init expects');
  });
});

describe('joinPath', () => {
  it('joins posix segments without doubling slashes', () => {
    expect(joinPath('/a/', 'b', 'c.txt')).toBe('/a/b/c.txt');
  });
});
