import type { AnimationName } from '../storyboard/motion-storyboard.schema';
import { animAttrs, esc } from './scene-html';
import type { Anim } from './scene-html';

const START_WITHOUT_CUE = 0.5;

type Timing = (after: number, anim: string) => Anim;

function timingFrom(cue: string | undefined): Timing {
  return (after, anim) => (cue ? { anim, cue, after, parallel: true } : { anim, at: START_WITHOUT_CUE + after, parallel: true });
}

function delivery(at: Timing): string {
  const store = `<g class="store"><rect x="440" y="170" width="150" height="160" rx="10" /><path class="awning" d="M428 170 h174 l-12 -40 h-150 z" /><rect class="door" x="495" y="250" width="40" height="80" rx="4" /></g>`;
  const pin = `<g class="pin"${animAttrs(at(1.55, 'pop'))}><path d="M515 22c-26 0-46 20-46 46 0 34 46 72 46 72s46-38 46-72c0-26-20-46-46-46z" /><circle cx="515" cy="68" r="16" /></g>`;
  const wheel = (cx: number): string => `<g class="wheel"${animAttrs(at(0, 'spin'))}><circle cx="${cx}" cy="318" r="22" /><path d="M${cx - 14} 318 h28 M${cx} 304 v28" /></g>`;
  const wheels = `${wheel(96)}${wheel(236)}`;
  const van = `<g transform="translate(110 0)"><g class="van"${animAttrs(at(0, 'drive'))}><path class="body" d="M50 220 h170 l60 40 v58 h-230 z" /><path class="glass" d="M222 230 h18 l38 28 h-56 z" /><rect class="stripe" x="62" y="262" width="140" height="12" rx="6" />${wheels}</g></g>`;
  return `<svg class="mg-anim-svg" viewBox="0 0 640 380"><line class="road" x1="20" y1="342" x2="620" y2="342" />${store}${pin}${van}</svg>`;
}

function payment(at: Timing): string {
  const card = `<g class="card"${animAttrs(at(0, 'left'))}><rect x="30" y="120" width="190" height="124" rx="16" /><rect class="band" x="30" y="150" width="190" height="24" /><rect class="chip" x="52" y="196" width="40" height="28" rx="6" /></g>`;
  const flow = `<path class="flow" pathLength="1" d="M232 182 C 300 120, 360 120, 420 182"${animAttrs(at(0.45, 'draw'))} />`;
  const account = `<g class="account"${animAttrs(at(0.9, 'pop'))}><rect x="420" y="110" width="190" height="150" rx="18" /><rect class="line" x="446" y="140" width="96" height="14" rx="7" /><rect class="line soft" x="446" y="168" width="138" height="12" rx="6" /><rect class="line soft" x="446" y="190" width="110" height="12" rx="6" /></g>`;
  const check = `<g class="ok"${animAttrs(at(1.5, 'pop'))}><circle cx="582" cy="250" r="34" /><path d="M566 250 l12 12 l22 -24" /></g>`;
  return `<svg class="mg-anim-svg" viewBox="0 0 640 340">${card}${flow}${account}${check}</svg>`;
}

const ORDER_STEP = 200;

function orders(at: Timing): string {
  const column = (x: number, tone: string): string => `<g class="col"><rect x="${x}" y="40" width="180" height="280" rx="16" /><rect class="head ${tone}" x="${x + 20}" y="62" width="70" height="12" rx="6" /></g>`;
  const card = (x: number, y: number): string => `<rect class="ticket" x="${x + 16}" y="${y}" width="148" height="58" rx="10" />`;
  const moving = `<g class="ticket-live"${animAttrs({ ...at(0.4, 'advance'), extra: { step: ORDER_STEP } })}>${card(20, 96)}<rect class="ticket-line" x="52" y="114" width="80" height="10" rx="5" /><rect class="ticket-line soft" x="52" y="132" width="56" height="8" rx="4" /></g>`;
  const done = `<g class="ok"${animAttrs(at(1.9, 'pop'))}><circle cx="566" cy="300" r="30" /><path d="M552 300 l10 10 l20 -22" /></g>`;
  return `<svg class="mg-anim-svg" viewBox="0 0 640 340">${column(20, 'zinc')}${column(220, 'warm')}${column(420, 'ok')}${card(20, 170)}${card(220, 110)}${card(420, 170)}${moving}${done}</svg>`;
}

function secureCloud(at: Timing): string {
  const cloud = `<g transform="translate(170 0) scale(14)"><path class="cloud" pathLength="1" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"${animAttrs(at(0, 'draw'))} /></g>`;
  const shackle = `<path class="shackle"${animAttrs(at(1.1, 'shackle'))} d="M312 160 v-28 a26 26 0 0 1 52 0 v28" />`;
  const lock = `<g class="lock"${animAttrs(at(0.7, 'pop'))}>${shackle}<rect x="296" y="156" width="84" height="72" rx="12" /><circle class="hole" cx="338" cy="190" r="9" /></g>`;
  return `<svg class="mg-anim-svg" viewBox="0 0 640 300">${cloud}${lock}</svg>`;
}

const EXAMPLE_DOMAIN = 'www.tunegocio.com.ar';

function domain(at: Timing): string {
  const bar = `<div class="mg-anim-bar"${animAttrs(at(0, 'rise'))}><i></i><i></i><i></i><span class="url"><b class="lock"${animAttrs(at(1.4, 'pop'))}></b><span${animAttrs({ ...at(0.3, 'type'), extra: { text: EXAMPLE_DOMAIN } })}></span></span></div>`;
  const page = `<div class="mg-anim-page"><span class="hero"${animAttrs(at(1.6, 'rise'))}></span><span class="row"${animAttrs(at(1.8, 'rise'))}></span><span class="row short"${animAttrs(at(2, 'rise'))}></span></div>`;
  return `<div class="mg-anim-browser">${bar}${page}</div>`;
}

function publish(at: Timing): string {
  const pills = `<span class="pill draft"${animAttrs(at(1.1, 'hide'))}>Borrador</span><span class="pill live"${animAttrs(at(1.1, 'swap'))}>Publicado</span>`;
  const button = `<span class="mg-btn"${animAttrs(at(0.8, 'press'))}>${esc('Publicar')}</span>`;
  return `<div class="mg-anim-editor"${animAttrs(at(0, 'rise'))}><div class="top">${pills}${button}</div><span class="block hero"></span><span class="block"></span><span class="block short"></span></div>`;
}

const RENDERERS: Record<AnimationName, (at: Timing) => string> = {
  delivery,
  payment,
  orders,
  'secure-cloud': secureCloud,
  domain,
  publish,
};

export function animationVisual(name: AnimationName, cue: string | undefined): string {
  return `<div class="mg-anim ${name}"${animAttrs({ anim: 'pop', cue, at: cue ? undefined : 0.2 })}>${RENDERERS[name](timingFrom(cue))}</div>`;
}
