/**
 * Identidad visual — docs/branding/brand/visual-guidelines.md
 * Dark-first sobre zinc-950, acentos sky-500 y teal/emerald.
 * Nada de violetas ("AI purple"), nada de Inter.
 */

export const W = 1920;
export const H = 1080;

export const C = {
  bg: '#09090b',
  surf: '#18181b',
  surf2: '#101012',
  surf3: '#0c0c0e',
  text: '#fafafa',
  dim: '#a1a1aa',
  dim2: '#71717a',
  line: 'rgba(255,255,255,0.07)',
  line2: 'rgba(255,255,255,0.13)',
  sky: '#0ea5e9',
  sky2: '#38bdf8',
  teal: '#14b8a6',
  emerald: '#34d399',
  amber: '#f59e0b',
  red: '#ef4444',
} as const;

export const F = {
  sans: "'Outfit', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export type ToneName = 'emerald' | 'sky' | 'amber' | 'rose' | 'indigo' | 'teal';

/** Trío [texto, fondo del ícono, borde del ícono] por tono — igual que StatCard del webapp. */
export const STAT_TONE: Record<ToneName, [string, string, string]> = {
  emerald: [C.emerald, 'rgba(52,211,153,0.12)', 'rgba(52,211,153,0.3)'],
  sky: [C.sky2, 'rgba(14,165,233,0.12)', 'rgba(14,165,233,0.3)'],
  amber: [C.amber, 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.3)'],
  rose: [C.red, 'rgba(239,68,68,0.12)', 'rgba(239,68,68,0.3)'],
  indigo: ['#818cf8', 'rgba(129,140,248,0.12)', 'rgba(129,140,248,0.3)'],
  teal: [C.teal, 'rgba(20,184,166,0.12)', 'rgba(20,184,166,0.3)'],
};
