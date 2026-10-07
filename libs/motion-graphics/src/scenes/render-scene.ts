import { MotionStudioError } from '../errors/motion-studio-error';
import type { MotionStoryboardScene, SceneOf } from '../storyboard/motion-storyboard.schema';
import { animAttrs, chip, esc, headline, icon, promo, screenStates, toneClass, visual } from './scene-html';
import type { SceneContext } from './scene-html';

type Renderer<K extends MotionStoryboardScene['kind']> = (scene: SceneOf<K>, ctx: SceneContext) => string;

const frame = (body: string) => `<div class="mg-frame">${body}</div>`;
const split = (copy: string, side: string, wide = false) => `<div class="mg-split${wide ? ' wide-visual' : ''}"><div class="mg-copy">${copy}</div><div class="mg-visual">${side}</div></div>`;
const kicker = (text: string | undefined) => (text ? `<span class="mg-kicker"${animAttrs({ anim: 'fade' })}>${esc(text)}</span>` : '');

const hook: Renderer<'hook'> = ({ props }) => {
  const [first, second] = props.lines;
  const line = (l: NonNullable<typeof first>, a: string, cue?: string) => `<div class="mg-swap-line"><h1 class="mg-h xl"${animAttrs({ anim: a, cue })}>${esc(l.title)}${l.accent ? ` <span class="mg-grad">${esc(l.accent)}</span>` : ''}</h1></div>`;
  const firstLine = first ? line(first, 'rise', first.cue) : '';
  const lines = second
    ? `<div class="mg-swap-stack">${firstLine.replace('<div class="mg-swap-line">', `<div class="mg-swap-line"${animAttrs({ anim: 'hide', cue: second.cue, after: -0.25, parallel: true })}>`)}${line(second, 'rise', second.cue)}</div>`
    : firstLine;
  const screen = props.screen
    ? `<div class="mg-glass mg-hook-screen"${animAttrs({ anim: 'right' })}><div class="face tone-dark" style="position:relative"${props.screen.stampCue ? animAttrs({ anim: 'shake', cue: props.screen.stampCue, after: 0.1, parallel: true }) : ''}>${promo(props.screen.kicker, props.screen.text, undefined)}${
        props.screen.offCue
          ? `<div class="mg-layer"${second ? animAttrs({ anim: 'hide', cue: second.cue, after: -0.1, parallel: true }) : ''}><div class="mg-off"${animAttrs({ anim: 'swap', cue: props.screen.offCue, parallel: true })}></div></div>`
          : ''
      }</div>${props.screen.stamp ? `<div class="mg-stamp"${animAttrs({ anim: 'pop', cue: props.screen.stampCue })}>${esc(props.screen.stamp)}</div>` : ''}</div>`
    : '';
  return frame(split(lines, screen));
};

const problem: Renderer<'problem'> = ({ props }) => {
  const cards = props.items
    .map((item, i) => `<div class="mg-glass mg-card"${animAttrs({ anim: 'rise', cue: item.cue })}>${icon(item.icon)}<h3>${esc(item.label)}</h3>${props.strike ? `<div class="mg-strike"${animAttrs({ anim: 'strike', beat: 8 + i * 2 })}></div>` : ''}</div>`)
    .join('');
  return frame(`<div class="mg-center" style="gap:70px">${kicker(props.kicker)}<div class="mg-cards">${cards}</div></div>`);
};

const brandReveal: Renderer<'brand-reveal'> = ({ props }, ctx) => {
  const tagline = props.tagline ?? ctx.brand.tagline;
  const accent = props.accent ?? (props.tagline ? undefined : ctx.brand.taglineAccent);
  const chips = (props.chips ?? []).map((c) => `<span class="mg-chip"${animAttrs({ anim: 'rise' })}>${esc(c)}</span>`).join('');
  return frame(`<div class="mg-center"><div class="mg-ring"${animAttrs({ anim: 'pop', at: 0, dur: 1.6 })}></div><img class="mg-logo" src="${esc(ctx.imageUrl(`brand:${ctx.brand.logo}`))}" alt="${esc(ctx.brand.name)}"${animAttrs({ anim: 'blur', at: 0 })} />${headline(tagline, accent, '', { anim: 'rise', at: 0.9 })}${chips ? `<div class="mg-chips" style="justify-content:center">${chips}</div>` : ''}</div>`);
};

const feature: Renderer<'feature'> = ({ props }, ctx) => {
  const bullets = props.bullets.length ? `<div class="mg-chips col">${props.bullets.map((b) => chip(b, 'lg', { anim: 'left' })).join('')}</div>` : '';
  const copy = `${kicker(props.kicker)}${headline(props.title, props.accent, 'lg')}${props.text ? `<p class="mg-p"${animAttrs({ anim: 'rise' })}>${esc(props.text)}</p>` : ''}${bullets}`;
  return frame(props.visual ? split(copy, visual(props.visual, ctx)) : `<div class="mg-copy" style="justify-content:center;flex:1">${copy}</div>`);
};

const remoteUpdate: Renderer<'remote-update'> = ({ props }) => {
  const cue = props.publishCue;
  const phone = `<div class="mg-phone" id="ru-phone"${animAttrs({ anim: 'rise' })}><div class="face"><div class="notch"></div><div class="mg-campaign"><span class="mg-label" style="font-size:15px">Campañas</span><div class="thumb tone-sky">${esc(props.campaign.badge)}</div><div class="t">${esc(props.campaign.name)}</div>${props.campaign.meta ? `<div class="m">${esc(props.campaign.meta)}</div>` : ''}<div class="mg-btn"${animAttrs({ anim: 'press', cue, beat: cue ? undefined : 4 })}>Publicar</div></div></div></div>`;
  const screens = props.screens
    .map(
      (s, i) => `<div class="mg-glass mg-mini" id="ru-s${i}"${animAttrs({ anim: 'right' })}><div class="lbl"><span class="mg-dot"></span>${esc(s.label)}</div><div class="face"><div class="before">${esc(s.before)}</div><div class="after tone-sky"${animAttrs({ anim: 'wipe', cue, beat: cue ? undefined : 4, after: 0.6 + i * 0.12, parallel: true })}>${s.kicker ? `<small>${esc(s.kicker)}</small>` : ''}${esc(s.after)}</div></div><span class="mg-chip ok"${animAttrs({ anim: 'pop', cue, beat: cue ? undefined : 4, after: 0.9 + i * 0.12, parallel: true })}>${icon('check')}actualizada</span></div>`,
    )
    .join('');
  const links = props.screens
    .map((_, i) => `<path data-from="#ru-phone" data-to="#ru-s${i}" pathLength="1"${animAttrs({ anim: 'draw', cue, beat: cue ? undefined : 4, after: 0.15 + i * 0.08, dur: 0.55, parallel: true })} />`)
    .join('');
  return frame(`${headline(props.title, props.accent)}<div class="mg-remote"><svg class="mg-links" data-links="1">${links}</svg>${phone}<div></div><div class="mg-screens">${screens}</div></div>`);
};

const schedule: Renderer<'schedule'> = ({ props }) => {
  const span = props.axis.to - props.axis.from;
  const pct = (h: number) => (((h - props.axis.from) / span) * 100).toFixed(2);
  const hours = Array.from(new Set([props.axis.from, ...props.blocks.flatMap((b) => [b.start, b.end]), props.axis.to]))
    .sort((a, b) => a - b)
    .map((h) => `<div class="mg-hour" style="left:${pct(h)}%"><span>${String(Math.floor(h)).padStart(2, '0')}:00</span></div>`)
    .join('');
  const blocks = props.blocks
    .map((b) => `<div class="mg-block ${toneClass(b.tone)}" style="left:${pct(b.start)}%;width:calc(${(((b.end - b.start) / span) * 100).toFixed(2)}% - 6px);top:${b.row === 1 ? 118 : 0}px;transform-origin:0 50%"${animAttrs({ anim: 'wipe', cue: b.cue })}><b>${esc(b.label)}</b><i>${String(b.start).padStart(2, '0')}–${String(b.end).padStart(2, '0')}</i></div>`)
    .join('');
  const days = props.days
    ? `<div class="mg-days">${['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
        .map((d) => {
          const on = props.days?.on.includes(d);
          const hl = props.days?.highlight?.includes(d);
          return `<div class="mg-day${on ? ' on' : ''}"${hl ? animAttrs({ anim: 'select', cue: props.days?.cue, parallel: true }) : ''}>${d}</div>`;
        })
        .join('')}</div>`
    : '';
  const tags = props.tags?.length ? `<div class="mg-sched-tags">${props.tags.map((t) => `<span class="mg-chip"${animAttrs({ anim: 'pop', cue: t.cue })}>${icon('pin')}${esc(t.text)}</span>`).join('')}</div>` : '';
  return frame(`${headline(props.title, props.accent)}<div class="mg-glass mg-sched"${animAttrs({ anim: 'rise' })}>${days}${tags}<div class="mg-track">${hours}${blocks}<div class="mg-playhead"${animAttrs({ anim: 'fade', at: 0.4, parallel: true })}></div></div></div>`);
};

const dashboard: Renderer<'dashboard'> = ({ props }) => {
  const alertCue = props.alert?.cue;
  const rows = props.rows
    .map((r, i) => {
      const failing = props.alert?.row === i;
      return `<div class="mg-tr"${animAttrs({ anim: 'left' })}><span class="mg-dot">${failing ? `<i class="off-dot"${animAttrs({ anim: 'swap', cue: alertCue, beat: alertCue ? undefined : 8, parallel: true })}></i>` : ''}</span><span class="n">${esc(r.name)}</span><span class="loc">${esc(r.place)}</span><span class="now">${esc(r.now)}${failing ? `<span class="off"${animAttrs({ anim: 'swap', cue: alertCue, beat: alertCue ? undefined : 8, parallel: true })}>Sin conexión</span>` : ''}</span></div>`;
    })
    .join('');
  const total = props.stat.total !== undefined ? `<em>/${props.stat.total}</em>` : '';
  const alt = props.alert ? `<span class="alt"${animAttrs({ anim: 'swap', cue: alertCue, beat: alertCue ? undefined : 8, after: 0.2, parallel: true })} style="background:var(--mg-surface)">${props.stat.value - 1}${total}</span>` : '';
  const stat = `<div class="mg-glass mg-stat"${animAttrs({ anim: 'right' })}><span class="mg-label">${esc(props.stat.label)}</span><div class="num"><span${animAttrs({ anim: 'count', cue: props.stat.cue, extra: { to: props.stat.value }, parallel: true })}>0</span>${total}${alt}</div><span class="mg-chip" style="align-self:flex-start"><span class="mg-dot"></span>En tiempo real</span></div>`;
  const alert = props.alert ? `<div class="mg-glass mg-alert"${animAttrs({ anim: 'pop', cue: alertCue, beat: alertCue ? undefined : 8, after: 0.25 })}>${icon('bell')}<div><b>${esc(props.alert.title)}</b><span>${esc(props.alert.detail)}</span></div></div>` : '';
  return frame(`${headline(props.title, props.accent)}<div class="mg-dash"><div class="mg-glass mg-table"${animAttrs({ anim: 'left' })}>${rows}</div><div>${stat}${alert}</div></div>`);
};

const aiGenerate: Renderer<'ai-generate'> = ({ props }, ctx) => {
  const result =
    'image' in props.result
      ? `<img src="${esc(ctx.imageUrl(props.result.image))}" alt="" />`
      : `<div class="mg-screen ${toneClass(props.result.tone, 'warm')}">${promo(props.result.kicker, props.result.big, props.result.small)}</div>`;
  const copy = `${headline(props.title, props.accent)}<div class="mg-glass mg-prompt"${animAttrs({ anim: 'left' })}><span class="mg-label" style="display:flex;gap:12px;align-items:center">${icon('sparkles')}${esc(props.label ?? 'Generar imagen')}</span><div class="q"><span${animAttrs({ anim: 'type', extra: { text: props.prompt }, parallel: true })}></span><span class="mg-caret"></span></div></div>${props.badge ? `<div class="mg-badge-row"><span class="mg-chip"${animAttrs({ anim: 'pop', cue: props.resultCue })}>${icon('sparkles')}${esc(props.badge)}</span></div>` : ''}`;
  const side = `<div class="mg-result"${animAttrs({ anim: 'pop', at: 1.2 })}>${result}<div class="mask"${animAttrs({ anim: 'hide', at: 1.6, dur: 1, parallel: true })}></div><div class="scan"${animAttrs({ anim: 'wipe-up', at: 1.6, dur: 1, parallel: true })}></div></div>`;
  return frame(split(copy, side));
};

const context: Renderer<'context'> = ({ props }) => {
  const chips = `<div class="mg-chips col" style="gap:26px">${props.chips.map((c) => chip(c, 'lg', { anim: 'left' })).join('')}</div>`;
  const pins = [
    [31, 37],
    [78, 44],
    [60, 84],
    [22, 70],
    [84, 22],
    [45, 18],
  ]
    .slice(0, props.radar?.pins ?? 0)
    .map(([x, y], i) => `<div class="mg-pin" style="left:${x}%;top:${y}%"${animAttrs({ anim: 'pop', cue: props.radar?.cue, after: i * 0.25 })}></div>`)
    .join('');
  const radar = props.radar
    ? `<div class="mg-radar"${animAttrs({ anim: 'pop' })}><div class="ring" style="inset:0"></div><div class="ring" style="inset:17%"></div><div class="ring" style="inset:34%"></div><div class="sweep"${animAttrs({ anim: 'sweep', at: 0.2, parallel: true })}></div><div class="mg-pin me" style="left:50%;top:50%"></div>${pins}<span class="mg-label" style="position:absolute;right:6%;top:3%">${esc(props.radar.label)}</span></div>`
    : '';
  return frame(radar ? split(`${headline(props.title, props.accent)}${chips}`, radar) : `${headline(props.title, props.accent)}${chips}`);
};

const suggestion: Renderer<'suggestion'> = ({ props }) => {
  const cue = props.actionCue;
  const text = props.accent && props.text.includes(props.accent) ? esc(props.text).replace(esc(props.accent), `<span class="mg-grad">${esc(props.accent)}</span>`) : esc(props.text);
  return frame(`<div class="mg-center"><div class="mg-glass mg-suggest"${animAttrs({ anim: 'rise' })}><div class="hd">${icon('sparkles')}<span class="mg-label" style="color:var(--mg-accent-2)">${esc(props.label)}</span></div><p>${text}</p><div class="act"><span class="mg-btn"${animAttrs({ anim: 'press', cue, beat: cue ? undefined : 10 })}>${esc(props.action)}<span class="mg-btn-done"${animAttrs({ anim: 'swap', cue, beat: cue ? undefined : 10, after: 0.1, parallel: true })}>${esc(props.done)}</span></span><span class="mg-chip">Ver detalle</span></div></div></div>`);
};

const product: Renderer<'product'> = ({ props }, ctx) => {
  const specs = props.specs?.length ? `<div class="mg-chips">${props.specs.map((s) => `<span class="mg-chip"${animAttrs({ anim: 'rise' })}>${esc(s)}</span>`).join('')}</div>` : '';
  const copy = `${kicker(props.kicker)}${headline(props.name, props.accent, 'xl', { anim: 'left', cue: props.textCue })}<p class="mg-p"${animAttrs({ anim: 'rise', cue: props.textCue })}>${esc(props.text)}</p>${specs}`;
  return frame(split(copy, visual(props.visual, ctx)));
};

const gallery: Renderer<'gallery'> = ({ props }, ctx) => {
  const n = props.images.length;
  const tiles = props.images.map((img, i) => `<div class="g g${i + 1}"${animAttrs({ anim: 'rise', beat: i })}><img src="${esc(ctx.imageUrl(img))}" alt=""${animAttrs({ anim: 'kenburns', beat: i, parallel: true })} /></div>`).join('');
  return frame(`<div class="mg-gallery n${n}">${tiles}</div>${props.caption ? `<span class="mg-label"${animAttrs({ anim: 'fade', beat: n })}>${esc(props.caption)}</span>` : ''}`);
};

const step: Renderer<'step'> = ({ props }, ctx) => {
  const head = `<div class="mg-step-head"${animAttrs({ anim: 'fade' })}>${props.n !== undefined ? `<span class="mg-step-n">${String(props.n).padStart(2, '0')}</span>` : ''}<span class="mg-label">${esc(props.label)}</span></div>`;
  const chips = props.chips?.length ? `<div class="mg-chips col">${props.chips.map((c) => chip(c)).join('')}</div>` : '';
  const copy = `${head}${headline(props.title, props.accent)}${props.text ? `<p class="mg-p"${animAttrs({ anim: 'rise' })}>${esc(props.text)}</p>` : ''}${chips}`;
  return frame(props.visual ? split(copy, visual(props.visual, ctx)) : `<div class="mg-copy">${copy}</div>`);
};

const connections: Renderer<'connections'> = ({ props }, ctx) => {
  const device = ctx.brand.devices[props.device];
  if (device === undefined) throw new MotionStudioError('ASSET_MISSING', `brand "${ctx.brand.id}" has no device "${props.device}"`);
  const deviceImg = ctx.imageUrl(`brand:${device.image}`);
  const peers = props.links.filter((l) => l.to !== 'tv');
  const peerIcon = { router: 'router', power: 'plug', phone: 'phone', tv: 'tv' } as const;
  const peerName = { router: 'Router del local', power: 'Fuente', phone: 'Celular', tv: 'Televisor' } as const;
  const tvLink = props.links.find((l) => l.to === 'tv');
  const tv = tvLink
    ? `<div class="tvbox"><div class="mg-tv" id="cx-tv"${animAttrs({ anim: 'right' })}><div class="face">${props.tv ? screenStates(props.tv, ctx) : '<div class="mg-screen off"><span>SIN SEÑAL</span></div>'}</div></div><span class="mg-chip" style="margin-top:18px"${animAttrs({ anim: 'rise', cue: tvLink.cue, after: 0.5 })}>${esc(tvLink.label)}</span></div>`
    : '<div class="tvbox"></div>';
  const peersHtml = peers.map((p, i) => `<div style="display:flex;flex-direction:column;gap:12px"><span class="mg-box" id="cx-p${i}"${animAttrs({ anim: 'rise', cue: p.cue, after: -0.4 })}>${icon(peerIcon[p.to])}${esc(peerName[p.to])}</span><span class="mg-chip"${animAttrs({ anim: 'rise', cue: p.cue, after: 0.5 })}>${esc(p.label)}</span></div>`).join('');
  const paths = [
    ...(tvLink ? [`<path class="cable" data-from="#cx-dev" data-to="#cx-tv" pathLength="1"${animAttrs({ anim: 'draw', cue: tvLink.cue })} />`] : []),
    ...peers.map((p, i) => `<path class="cable ${p.to === 'router' ? 'teal' : 'zinc'}" data-from="#cx-p${i}" data-to="#cx-dev" data-from-side="top" data-to-side="bottom" pathLength="1"${animAttrs({ anim: 'draw', cue: p.cue })} />`),
  ].join('');
  return frame(`${headline(props.title, props.accent)}<div class="mg-conn"><svg class="mg-links" data-links="1">${paths}</svg><div class="dev" id="cx-dev"${animAttrs({ anim: 'left' })}><img src="${esc(deviceImg)}" alt="" /></div>${tv}<div class="peers">${peersHtml}</div></div>`);
};

const doDont: Renderer<'do-dont'> = ({ props }) => {
  const card = (side: 'bad' | 'good', c: typeof props.bad) =>
    `<div class="mg-glass card ${side}"${animAttrs({ anim: 'rise', cue: c.cue })}><span class="big">${icon(side === 'bad' ? 'alert' : 'check')}</span><h3>${esc(c.title)}</h3><div class="mg-chips col">${c.items.map((i) => `<span class="mg-chip ${side === 'bad' ? 'no' : 'ok'}">${icon(side === 'bad' ? 'x' : 'check')}${esc(i)}</span>`).join('')}</div></div>`;
  return frame(`${headline(props.title, props.accent)}<div class="mg-dd">${card('bad', props.bad)}${card('good', props.good)}</div>`);
};

const cta: Renderer<'cta'> = ({ props }, ctx) => {
  const tagline = props.tagline ?? ctx.brand.tagline;
  const accent = props.accent ?? (props.tagline ? undefined : ctx.brand.taglineAccent);
  const url = props.url ?? ctx.brand.url;
  return frame(`<div class="mg-center"><img class="mg-logo" style="width:min(900px,88%)" src="${esc(ctx.imageUrl(`brand:${ctx.brand.logo}`))}" alt="${esc(ctx.brand.name)}"${animAttrs({ anim: 'blur', at: 0 })} />${headline(tagline, accent, '', { anim: 'rise', at: 1 })}<div class="mg-cta-row"${animAttrs({ anim: 'rise', cue: props.buttonCue, at: props.buttonCue ? undefined : 2 })}><span class="mg-btn"${animAttrs({ anim: 'glow', cue: props.buttonCue, at: props.buttonCue ? undefined : 2.5, parallel: true })}>${esc(props.button)}</span>${url ? `<span class="mg-url-chip">${esc(url)}</span>` : ''}</div></div>`);
};

const RENDERERS: { [K in MotionStoryboardScene['kind']]: Renderer<K> } = {
  hook,
  problem,
  'brand-reveal': brandReveal,
  feature,
  'remote-update': remoteUpdate,
  schedule,
  dashboard,
  'ai-generate': aiGenerate,
  context,
  suggestion,
  product,
  gallery,
  step,
  connections,
  'do-dont': doDont,
  cta,
};

export function renderScene(scene: MotionStoryboardScene, ctx: SceneContext): string {
  const renderer = RENDERERS[scene.kind] as Renderer<typeof scene.kind>;
  return renderer(scene as never, ctx);
}
