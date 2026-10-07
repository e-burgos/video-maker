import { describe, expect, it } from 'vitest';

import { catalogStoryboard, testBrand } from '../__fixtures__/catalog-storyboard';
import { MotionStudioError } from '../errors/motion-studio-error';
import { ICON_NAMES } from '../storyboard/motion-storyboard.schema';
import { ICON_PATHS, iconSprite } from './icons';
import { renderScene } from './render-scene';
import { animAttrs, esc, headline, promo, screenInner } from './scene-html';
import type { SceneContext } from './scene-html';

const ctx: SceneContext = { brand: testBrand, format: '16:9', imageUrl: (ref) => (ref.startsWith('brand:') ? `assets/brand/${ref.slice(6)}` : ref) };
const scene = (id: string) => {
  const found = catalogStoryboard.scenes.find((s) => s.id === id);
  if (!found) throw new Error(id);
  return found;
};
const html = (id: string, c: SceneContext = ctx) => renderScene(scene(id), c);

describe('scene html helpers', () => {
  it('escapes text and serializes animation attributes', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(animAttrs(null)).toBe('');
    expect(animAttrs({ anim: 'rise', cue: 'hola', at: 1, beat: 2, dur: 0.5, after: 0.2, parallel: true, extra: { to: 3 } })).toBe(
      ' data-anim="rise" data-cue="hola" data-at="1" data-beat="2" data-dur="0.5" data-after="0.2" data-parallel="1" data-to="3"',
    );
  });

  it('ships a sprite path for every icon the schema accepts', () => {
    expect(Object.keys(ICON_PATHS).sort()).toEqual([...ICON_NAMES].sort());
    expect(iconSprite()).toContain('<symbol id="i-wifi"');
  });

  it('times list screen extras on the cue or on beats when there is no cue', () => {
    const list = { type: 'list' as const, title: 'Redes', items: ['A'], select: 0, field: 'Clave', button: 'Ir' };
    expect(screenInner(list, ctx, 'red')).toContain('data-cue="red" data-after="2.4"');
    expect(screenInner(list, ctx, undefined)).toContain('data-beat="6"');
  });
});

describe('promo', () => {
  it('shrinks the big promo text by length so a long offer stays inside its card', () => {
    expect(promo(undefined, '2x1', undefined)).toContain('<span class="b">2x1</span>');
    expect(promo(undefined, '-20 %', undefined)).toContain('<span class="b">');
    expect(promo(undefined, 'Merienda', undefined)).toContain('<span class="b fit-mid">');
    expect(promo(undefined, '2×1 Medialunas', undefined)).toContain('<span class="b fit-long">');
  });
});

describe('headline', () => {
  it('keeps hyphenated words on one line', () => {
    expect(headline('Configurá el Wi-Fi', 'desde el celular-app')).toBe('<h2 class="mg-h " data-anim="rise">Configurá el Wi\u2011Fi <span class="mg-grad">desde el celular\u2011app</span></h2>');
  });
});

describe('renderScene', () => {
  it('renders every scene of the catalog fixture', () => {
    for (const s of catalogStoryboard.scenes) expect(renderScene(s, ctx)).toContain('class="mg-frame"');
  });

  it('hook swaps the first line out when the second is spoken and turns the screen off on its cue', () => {
    const out = html('hook');
    expect(out).toContain('data-anim="hide" data-cue="promo" data-after="-0.25"');
    expect(out).toContain('data-anim="swap" data-cue="apagada"');
    expect(out).toContain('<div class="mg-stamp" data-anim="pop" data-cue="vencida">VENCIDA</div>');
    expect(html('hook-solo')).not.toContain('mg-swap-stack');
  });

  it('problem strikes cards only when asked', () => {
    expect(html('pain')).toContain('data-anim="strike"');
    expect(html('pain-soft')).not.toContain('mg-strike');
  });

  it('brand reveal and cta fall back to the brand tagline and url', () => {
    expect(html('reveal')).toContain('Todo bajo control. <span class="mg-grad">Con IA.</span>');
    expect(html('reveal-own')).toContain('Otra frase <span class="mg-grad">propia</span>');
    expect(html('cta')).toContain('acme.test');
    expect(html('cta')).toContain('data-anim="glow" data-cue="cotización"');
    expect(html('cta-own')).toContain('otro.test');
    expect(html('cta-own')).toContain('data-at="2.5"');
  });

  it('feature picks a chip icon from its tone and lays out with or without a visual', () => {
    const out = html('feature');
    expect(out).toContain('mg-chip lg ok');
    expect(out).toContain('#i-x');
    expect(out).toContain('#i-alert');
    expect(out).toContain('#i-zap');
    expect(out).toContain('src="images/foto.jpg"');
    expect(html('feature-plain')).not.toContain('mg-split');
  });

  it('remote update ties every screen and link to the publish cue, or to beats without it', () => {
    expect(html('remote').match(/data-cue="celular"/gu)?.length).toBeGreaterThan(5);
    expect(html('remote-beat')).toContain('data-beat="4"');
  });

  it('schedule places blocks on the hour axis', () => {
    const out = html('schedule');
    expect(out).toContain('left:0.00%;width:calc(23.53% - 6px);top:0px');
    expect(out).toContain('top:118px');
    expect(out).toContain('data-anim="select" data-cue="día"');
    expect(html('schedule-min')).not.toContain('mg-days');
  });

  it('dashboard counts up and flips the failing row on the alert cue', () => {
    expect(html('dash')).toContain('data-anim="count" data-cue="línea" data-parallel="1" data-to="2"');
    expect(html('dash')).toContain('Sin conexión');
    expect(html('dash-beat')).toContain('data-beat="8"');
    expect(html('dash-ok')).not.toContain('mg-alert');
  });

  it('ai generate shows an image or a promo result', () => {
    expect(html('ai')).toContain('assets/brand/local');
    expect(html('ai-promo')).toContain('tone-teal');
    expect(html('ai-promo')).toContain('Generar imagen');
  });

  it('context draws radar pins only when there is a radar', () => {
    expect(html('context').match(/class="mg-pin" /gu)?.length).toBe(3);
    expect(html('context-flat')).not.toContain('mg-radar');
  });

  it('suggestion highlights the accent only when it is part of the text', () => {
    expect(html('suggest')).toContain('<span class="mg-grad">promo de lluvia</span>');
    expect(html('suggest-plain')).not.toContain('mg-grad');
    expect(html('suggest-plain')).toContain('data-beat="10"');
  });

  it('product clips screen states into the device polygon', () => {
    const out = html('product');
    expect(out).toContain('clip-path:polygon(20% 10%, 60% 12%, 80% 86%, 40% 89%)');
    expect(out).toContain('skewY(6deg) rotate(4deg)');
    expect(out).toContain('data-anim="swap" data-cue="todo"');
    expect(html('product-box')).not.toContain('clip-path');
    expect(html('product-flat')).toContain('skewY(0deg) rotate(0deg)');
  });

  it('ui screens on a device sit on the screen quad instead of the whole device image', () => {
    const list = { type: 'list' as const, title: 'Redes', items: ['Local'], select: 0 };
    const product = scene('product');
    const onDevice = (device: string) => renderScene({ ...product, props: { ...product.props, visual: { kind: 'device', device, states: [{ screen: list }] } } } as never, ctx);
    expect(onDevice('counter')).toContain('<div class="mg-device-screen" style="left:20%;top:10%;width:41.5%;height:80.5%;transform:matrix(1, 0.0625, 0.2025, 1, 0, 0);transform-origin:0 0"><div class="mg-screen"><div class="mg-ui">');
    expect(onDevice('flat')).toContain('style="left:0%;top:0%;width:101.5%;height:101.5%;transform:skewY(0deg) rotate(0deg);transform-origin:0 0"');
  });

  it('ignores an accent that comes without its own tagline so it never trails the brand tagline', () => {
    const orphanAccent = (id: string) => {
      const found = scene(id);
      return renderScene({ ...found, props: { ...found.props, tagline: undefined, accent: 'hoy mismo' } } as never, ctx);
    };
    for (const id of ['cta', 'reveal']) expect(orphanAccent(id)).not.toContain('hoy mismo');
  });

  it('device visuals fail when the brand lacks the device', () => {
    const missing = { ...scene('product-box'), props: { name: 'X', text: 'Y', visual: { kind: 'device' as const, device: 'nope' } } };
    expect(() => renderScene(missing as never, ctx)).toThrow(MotionStudioError);
  });

  it('gallery adapts to the number of images', () => {
    expect(html('gallery')).toContain('mg-gallery n3');
    expect(html('gallery-bare')).not.toContain('mg-label');
  });

  it('step renders phone, tablet and plain variants', () => {
    expect(html('step')).toContain('mg-phone');
    expect(html('step')).toContain('data-text="http://10.0.0.1"');
    expect(html('step-tablet')).toContain('mg-tablet');
    expect(html('step-bare')).not.toContain('mg-visual');
  });

  it('countdown and timer visuals', () => {
    expect(html('countdown').match(/<span>\d+<\/span>/gu)?.length).toBe(11);
    expect(html('countdown-icon')).toContain('#i-zap');
    expect(html('timer')).toContain('reintentando');
    expect(html('timer-bare')).not.toContain('mg-label');
    expect(html('icons')).toContain('#i-shield');
    expect(html('tv')).toContain('mg-tv');
  });

  it('connections draw cables from the device to the tv and each peer', () => {
    const out = html('conn');
    expect(out).toContain('data-from="#cx-dev" data-to="#cx-tv"');
    expect(out).toContain('class="cable teal"');
    expect(out).toContain('class="cable zinc"');
    expect(html('conn-ext')).toContain('assets/brand/img/flat.png');
    expect(() => renderScene({ ...scene('conn-tv'), props: { title: 'X', device: 'nope', links: [{ to: 'tv', label: 'HDMI' }] } } as never, ctx)).toThrow(/no device "nope"/u);
    expect(html('conn-tv')).toContain('SIN SEÑAL');
  });

  it('do-dont renders both cards', () => {
    expect(html('dd')).toContain('card bad');
    expect(html('dd')).toContain('card good');
  });
});
