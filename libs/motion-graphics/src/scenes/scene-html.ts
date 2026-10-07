import type { BrandManifest } from '../brand/brand-manifest';
import { MotionStudioError } from '../errors/motion-studio-error';
import type { IconName, MotionChip, MotionScreen, MotionVisual } from '../storyboard/motion-storyboard.schema';

export interface SceneContext {
  brand: BrandManifest;
  format: '16:9' | '9:16';
  imageUrl: (ref: string) => string;
}

export interface Anim {
  anim: string;
  cue?: string | undefined;
  at?: number | undefined;
  beat?: number | undefined;
  dur?: number | undefined;
  after?: number | undefined;
  parallel?: boolean | undefined;
  extra?: Record<string, string | number>;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(text: string): string {
  return text.replace(/[&<>"']/gu, (c) => ESCAPES[c] ?? c);
}

export function animAttrs(a: Anim | null): string {
  if (a === null) return '';
  const parts = [`data-anim="${esc(a.anim)}"`];
  if (a.cue !== undefined) parts.push(`data-cue="${esc(a.cue)}"`);
  if (a.at !== undefined) parts.push(`data-at="${a.at}"`);
  if (a.beat !== undefined) parts.push(`data-beat="${a.beat}"`);
  if (a.dur !== undefined) parts.push(`data-dur="${a.dur}"`);
  if (a.after !== undefined) parts.push(`data-after="${a.after}"`);
  if (a.parallel) parts.push('data-parallel="1"');
  for (const [key, value] of Object.entries(a.extra ?? {})) parts.push(`data-${key}="${esc(String(value))}"`);
  return ` ${parts.join(' ')}`;
}

export function icon(name: IconName): string {
  return `<svg class="mg-icon"><use href="#i-${name}"></use></svg>`;
}

const NON_BREAKING_HYPHEN = '\u2011';

function keepHyphenatedWordsTogether(text: string): string {
  return text.replace(/(?<=\p{L})-(?=\p{L})/gu, NON_BREAKING_HYPHEN);
}

export function headline(title: string, accent: string | undefined, size: '' | 'lg' | 'xl' = '', a: Anim | null = { anim: 'rise' }): string {
  const accentHtml = accent ? ` <span class="mg-grad">${esc(keepHyphenatedWordsTogether(accent))}</span>` : '';
  return `<h2 class="mg-h ${size}"${animAttrs(a)}>${esc(keepHyphenatedWordsTogether(title))}${accentHtml}</h2>`;
}

export function chip(c: MotionChip, size: '' | 'lg' = '', fallback: Anim = { anim: 'rise' }): string {
  const tone = c.tone ? ` ${c.tone}` : '';
  const iconName: IconName | undefined = c.icon ?? (c.tone === 'ok' ? 'check' : c.tone === 'no' ? 'x' : c.tone === 'warn' ? 'alert' : undefined);
  return `<span class="mg-chip ${size}${tone}"${animAttrs({ ...fallback, cue: c.cue })}>${iconName ? icon(iconName) : ''}${esc(c.text)}</span>`;
}

export function toneClass(tone: string | undefined, fallback = 'sky'): string {
  return `tone-${tone ?? fallback}`;
}

const PROMO_BIG_FITS_AS_IS = 5;
const PROMO_BIG_FITS_MID = 9;

export function promoBigClass(big: string): string {
  const length = [...big.trim()].length;
  if (length <= PROMO_BIG_FITS_AS_IS) return 'b';
  return length <= PROMO_BIG_FITS_MID ? 'b fit-mid' : 'b fit-long';
}

export function promo(kicker: string | undefined, big: string, small: string | undefined): string {
  return `<div class="mg-promo">${kicker ? `<span class="k">${esc(kicker)}</span>` : ''}<span class="${promoBigClass(big)}">${esc(big)}</span>${small ? `<span class="s">${esc(small)}</span>` : ''}</div>`;
}

export function screenInner(screen: MotionScreen, ctx: SceneContext, firstCue: string | undefined): string {
  switch (screen.type) {
    case 'promo':
      return `<div class="mg-screen ${toneClass(screen.tone)}">${promo(screen.kicker, screen.big, screen.small)}</div>`;
    case 'boot':
      return `<div class="mg-screen boot"><img src="${esc(ctx.imageUrl(`brand:${ctx.brand.isotipo}`))}" alt=""${animAttrs({ anim: 'pop', cue: firstCue, at: firstCue ? undefined : 0.4 })} /></div>`;
    case 'off':
      return `<div class="mg-screen off">${screen.text ? `<span>${esc(screen.text)}</span>` : ''}</div>`;
    case 'image':
      return `<div class="mg-screen image"><img src="${esc(ctx.imageUrl(screen.src))}" alt="" /></div>`;
    case 'status':
      return `<div class="mg-screen"><div class="mg-status"><span${animAttrs({ anim: 'pop', cue: firstCue, parallel: true })}>${icon(screen.ok === false ? 'alert' : 'check')}</span><b>${esc(screen.title)}</b><span class="mg-label">${esc(screen.status)}</span></div></div>`;
    case 'url':
      return `<div class="mg-screen"><div class="mg-ui"><span class="sub">Ajustes</span>${
        screen.toggle
          ? `<div class="mg-row">${icon('signal')}${esc(screen.toggle)}<div class="mg-toggle" style="background:var(--mg-ok)"><i style="left:1.4em"></i><div class="mg-toggle" style="position:absolute;inset:0;margin:0;background:var(--mg-border-strong)"${animAttrs({ anim: 'swap', cue: firstCue, parallel: true })}><i style="left:0.18em"></i></div></div></div>`
          : ''
      }<span class="sub" style="margin-top:20px">Navegador</span><div class="mg-url"><span${animAttrs({ anim: 'type', cue: firstCue, extra: { text: screen.url }, parallel: true })}></span></div></div></div>`;
    case 'list': {
      const rows = screen.items
        .map((item, i) => {
          const selected = screen.select === i;
          return `<div class="mg-row" style="position:relative"${selected ? animAttrs({ anim: 'select', cue: firstCue, parallel: true }) : ''}>${icon('wifi')}${esc(item)}${
            selected ? `<i class="mg-tap" style="left:30%;top:50%"${animAttrs({ anim: 'tap', cue: firstCue, parallel: true })}></i>` : ''
          }</div>`;
        })
        .join('');
      const later = (after: number, beat: number): Anim => (firstCue ? { anim: '', cue: firstCue, after, parallel: true } : { anim: '', beat, parallel: true });
      const field = screen.field ? `<span class="sub">${esc(screen.field)}</span><div class="mg-field"><span${animAttrs({ ...later(1, 3), anim: 'dots' })}></span></div>` : '';
      const button = screen.button ? `<div class="mg-btn"${animAttrs({ ...later(2.4, 6), anim: 'press' })}>${esc(screen.button)}</div>` : '';
      return `<div class="mg-screen"><div class="mg-ui">${screen.sub ? `<span class="sub">${esc(screen.sub)}</span>` : ''}<h4>${esc(screen.title)}</h4>${rows}${field}${button}</div></div>`;
    }
  }
}

export function screenStates(states: Array<{ screen: MotionScreen; cue?: string | undefined }>, ctx: SceneContext): string {
  return states
    .map((state, i) => {
      const anim = i === 0 ? '' : animAttrs({ anim: 'swap', cue: state.cue, beat: state.cue ? undefined : i * 4 });
      return `<div class="mg-layer"${anim}>${screenInner(state.screen, ctx, i === 0 ? undefined : state.cue)}</div>`;
    })
    .join('');
}

const SCREEN_OVERFILL = 1.5;
const UI_SCREEN_TYPES: ReadonlySet<MotionScreen['type']> = new Set(['list', 'status', 'url']);

function parallelogramMatrix(topLeft: [number, number], topRight: [number, number], bottomLeft: [number, number], aspect: number): string {
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const shearY = (topRight[1] - topLeft[1]) / (topRight[0] - topLeft[0]) / aspect;
  const shearX = ((bottomLeft[0] - topLeft[0]) / (bottomLeft[1] - topLeft[1])) * aspect;
  return `matrix(1, ${round(shearY)}, ${round(shearX)}, 1, 0, 0)`;
}

function screenQuadBox(polygon: Array<[number, number]>, aspect: number | undefined, fallbackTransform: string): string {
  const [topLeft, topRight, , bottomLeft] = polygon;
  if (!topLeft || !topRight || !bottomLeft) return 'inset:0';
  const round = (n: number) => Math.round(n * 100) / 100;
  const transform = aspect === undefined ? fallbackTransform : parallelogramMatrix(topLeft, topRight, bottomLeft, aspect);
  return `left:${topLeft[0]}%;top:${topLeft[1]}%;width:${round(topRight[0] - topLeft[0] + SCREEN_OVERFILL)}%;height:${round(bottomLeft[1] - topLeft[1] + SCREEN_OVERFILL)}%;transform:${transform};transform-origin:0 0`;
}

function deviceVisual(deviceId: string, states: Array<{ screen: MotionScreen; cue?: string | undefined }> | undefined, ctx: SceneContext, height: number): string {
  const device = ctx.brand.devices[deviceId];
  if (device === undefined) throw new MotionStudioError('ASSET_MISSING', `brand "${ctx.brand.id}" has no device "${deviceId}"`);
  const img = `<img src="${esc(ctx.imageUrl(`brand:${device.image}`))}" alt="${esc(device.name)}" />`;
  if (!device.screen || !states) return `<div class="mg-device" style="height:${height}px"${animAttrs({ anim: 'right' })}><div class="mg-device-glow"></div>${img}</div>`;
  const pts = device.screen.polygon;
  const aspect = device.screen.aspect;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const clip = `polygon(${pts.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
  const skew = `skewY(${device.screen.skew ?? 0}deg) rotate(${device.screen.rotate ?? 0}deg)`;
  const box = `left:${left + (Math.max(...xs) - left) * 0.18}%;top:${top + (Math.max(...ys) - top) * 0.36}%;width:${(Math.max(...xs) - left) * 0.62}%;height:${(Math.max(...ys) - top) * 0.4}%;transform:${skew};transform-origin:0 0`;
  const layers = states
    .map((state, i) => {
      const anim = i === 0 ? '' : animAttrs({ anim: 'swap', cue: state.cue, beat: state.cue ? undefined : i * 4 });
      const cue = i === 0 ? undefined : state.cue;
      const inner =
        state.screen.type === 'promo'
          ? `<div class="mg-screen ${toneClass(state.screen.tone)}"><div class="mg-promo" style="position:absolute;inset:auto;${box};padding:0;justify-content:flex-start">${state.screen.kicker ? `<span class="k">${esc(state.screen.kicker)}</span>` : ''}<span class="${promoBigClass(state.screen.big)}">${esc(state.screen.big)}</span>${state.screen.small ? `<span class="s">${esc(state.screen.small)}</span>` : ''}</div></div>`
          : UI_SCREEN_TYPES.has(state.screen.type)
            ? `<div class="mg-device-screen" style="${screenQuadBox(pts, aspect, skew)}">${screenInner(state.screen, ctx, cue)}</div>`
            : screenInner(state.screen, ctx, cue);
      return `<div class="mg-layer"${anim}>${inner}</div>`;
    })
    .join('');
  return `<div class="mg-device" style="height:${height}px"${animAttrs({ anim: 'right' })}><div class="mg-device-glow"></div>${img}<div class="face" style="clip-path:${clip}">${layers}</div></div>`;
}

export function visual(v: MotionVisual, ctx: SceneContext): string {
  switch (v.kind) {
    case 'image':
      return `<div class="mg-image"${animAttrs({ anim: 'right' })}><img src="${esc(ctx.imageUrl(v.src))}" alt=""${animAttrs({ anim: 'kenburns', at: 0, parallel: true })} /></div>`;
    case 'device':
      return deviceVisual(v.device, v.states, ctx, ctx.format === '9:16' ? 900 : 800);
    case 'phone':
      return `<div class="mg-phone"${animAttrs({ anim: 'rise' })}><div class="face"><div class="notch"></div>${screenStates(v.states, ctx)}</div></div>`;
    case 'tablet':
      return `<div class="mg-tablet"${animAttrs({ anim: 'rise' })}><div class="face">${screenStates(v.states, ctx)}</div></div>`;
    case 'tv':
      return `<div class="mg-tv"${animAttrs({ anim: 'right' })}><div class="face">${screenStates(v.states, ctx)}</div></div>`;
    case 'icon':
      return `<div class="mg-big-icon"${animAttrs({ anim: 'pop' })}>${icon(v.icon)}</div>`;
    case 'countdown': {
      const numbers = Array.from({ length: v.seconds + 1 }, (_, i) => `<span>${v.seconds - i}</span>`).join('');
      return `<div class="mg-round"${animAttrs({ anim: 'pop' })}><svg viewBox="0 0 600 600"><circle class="bg" cx="300" cy="300" r="270" /><circle class="fg" cx="300" cy="300" r="270" pathLength="1"${animAttrs({ anim: 'ring', cue: v.cue, dur: v.seconds * 0.3, parallel: true })} /></svg><div class="center">${icon(v.icon ?? 'plug')}<div class="num"${animAttrs({ anim: 'seq', cue: v.cue, dur: v.seconds * 0.3, parallel: true })}>${numbers}</div><span class="mg-label">segundos</span></div></div>`;
    }
    case 'timer': {
      const labels = v.labels.map((l) => `<span>${esc(l)}</span>`).join('');
      return `<div class="mg-round" style="width:420px;height:420px"${animAttrs({ anim: 'pop', cue: v.cue })}><svg viewBox="0 0 600 600"><circle class="bg" cx="300" cy="300" r="270" /><circle class="fg" cx="300" cy="300" r="270" pathLength="1"${animAttrs({ anim: 'ring', cue: v.cue, dur: 3.2, parallel: true })} /></svg><div class="center"><div class="num" style="font-size:84px;height:90px;width:280px"${animAttrs({ anim: 'seq', cue: v.cue, dur: 4.2, parallel: true })}>${labels}</div>${v.caption ? `<span class="mg-label">${esc(v.caption)}</span>` : ''}</div></div>`;
    }
  }
}
