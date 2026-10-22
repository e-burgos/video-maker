import { describe, expect, it } from 'vitest';

import { ANIMATION_NAMES, VisualSchema } from '../storyboard/motion-storyboard.schema';
import { animationVisual } from './animations';
import { screenInner, visual } from './scene-html';
import type { SceneContext } from './scene-html';
import { testBrand } from '../__fixtures__/catalog-storyboard';

const ctx: SceneContext = { brand: testBrand, format: '9:16', imageUrl: (ref) => ref };

describe('animation visuals', () => {
  it('renders every animation name the schema accepts', () => {
    for (const name of ANIMATION_NAMES) {
      const html = animationVisual(name, undefined);
      expect(html).toContain(`class="mg-anim ${name}"`);
      expect(html).toContain('data-at=');
    }
  });

  it('times every part of an animation on its cue when there is one', () => {
    const html = animationVisual('delivery', 'retiro');
    expect(html).toContain('data-anim="drive" data-cue="retiro"');
    expect(html).toContain('data-anim="pop" data-cue="retiro" data-after="1.55"');
    expect(html).not.toContain('data-at=');
  });

  it('types an example domain and moves the order card by a fixed step', () => {
    expect(animationVisual('domain', undefined)).toContain('data-text="www.tunegocio.com.ar"');
    expect(animationVisual('orders', 'pedidos')).toContain('data-anim="advance" data-cue="pedidos" data-after="0.4" data-parallel="1" data-step="200"');
  });
});

describe('scrolling captures', () => {
  it('scrolls an image screen only when asked', () => {
    expect(screenInner({ type: 'image', src: 'images/a.png', scroll: true }, ctx, undefined)).toContain('class="mg-screen image scroll"');
    expect(screenInner({ type: 'image', src: 'images/a.png', scroll: true }, ctx, undefined)).toContain('data-anim="scroll" data-at="0.6"');
    expect(screenInner({ type: 'image', src: 'images/a.png' }, ctx, undefined)).not.toContain('data-anim="scroll"');
  });

  it('shows the same site on a monitor, a tablet and a phone, scrolling one after the other', () => {
    const parsed = VisualSchema.parse({ kind: 'devices', images: ['images/d.png', 'images/t.png', 'images/p.png'], scroll: true });
    const html = visual(parsed, ctx);
    expect(html).toMatch(/mg-monitor[\s\S]*images\/d\.png[\s\S]*mg-tablet[\s\S]*images\/t\.png[\s\S]*mg-phone[\s\S]*images\/p\.png/u);
    expect(html.match(/data-anim="scroll"/gu)).toHaveLength(3);
    expect(html).toContain('data-at="1.05"');
    expect(visual({ kind: 'devices', images: ['images/d.png', 'images/t.png', 'images/p.png'] }, ctx)).not.toContain('data-anim="scroll"');
  });
});
