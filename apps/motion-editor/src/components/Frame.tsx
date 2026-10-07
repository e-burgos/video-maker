import type { ReactNode } from 'react';
import { clamp } from '../engine/api';
import { C, F, W, H } from '../theme';
import type { Clock } from '../motion';

/**
 * EL ESCENARIO PERSISTENTE.
 *
 * Estos elementos aparecen en TODAS las escenas y no cambian: son lo que
 * hace que el video se lea como una pieza continua en vez de clips sueltos.
 * Las escenas suman cosas arriba de esto; nunca lo reemplazan.
 *
 * Además, <Frame> resuelve el contrato de frame-match: el contenido propio
 * de cada escena entra y sale DENTRO de la escena, así el primer frame de
 * una escena es idéntico al último de la anterior y ningún corte "salta".
 */

const FADE = 0.45;

export function Backdrop({ p }: { p: number }) {
  // sin(2πp) vale 0 en p=0 y en p=1 → la deriva es continua entre escenas.
  const d = Math.sin(p * Math.PI * 2);
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -240 + d * 26,
          top: -300,
          width: 1300,
          height: 980,
          background: 'radial-gradient(circle, rgba(14,165,233,0.17), rgba(14,165,233,0) 68%)',
          filter: 'blur(30px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -360,
          bottom: -420 - d * 22,
          width: 1200,
          height: 960,
          background: 'radial-gradient(circle, rgba(20,184,166,0.11), rgba(20,184,166,0) 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(9,9,11,0.35), rgba(9,9,11,0) 32%, rgba(9,9,11,0.55))',
        }}
      />
    </div>
  );
}

export function Watermark() {
  return (
    <img
      src="/assets/logo.svg"
      alt="DisplayAds"
      style={{ position: 'absolute', left: 74, top: 60, height: 52, width: 'auto', opacity: 0.9 }}
    />
  );
}

// Renombrado a `ClockChip` (Ciclo 75, DEC-75-006): evita colisión de nombre con el
// tipo `Clock` importado de `../motion` (no-redeclare). Sin uso externo: no se
// exporta desde ningún barrel ni se importa fuera de este archivo.
export function ClockChip({ label, o }: { label?: string; o: number }) {
  if (!label) return null;
  return (
    <div
      style={{
        position: 'absolute',
        right: 74,
        top: 62,
        opacity: o,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 18px',
        borderRadius: 999,
        background: 'rgba(24,24,27,0.8)',
        border: `1px solid ${C.line2}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: C.emerald,
          boxShadow: `0 0 12px ${C.emerald}`,
        }}
      />
      <span style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: '0.1em', color: C.text }}>
        {label}
      </span>
    </div>
  );
}

export function Caption({
  kicker,
  line,
  o,
  show,
}: {
  kicker?: string;
  line?: string;
  o: number;
  show: boolean;
}) {
  if (!show || !kicker) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 84,
        right: 400,
        bottom: 72,
        opacity: o,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 18,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: C.sky2,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: F.sans,
          fontSize: 42,
          fontWeight: 600,
          lineHeight: 1.12,
          letterSpacing: '-0.025em',
          color: C.text,
          textWrap: 'pretty',
        }}
      >
        {line}
      </div>
    </div>
  );
}

/** Interruptor global de subtítulos, controlado desde el panel de tweaks. */
export const captionsFlag = { on: true };

export interface FrameProps {
  clock: Clock;
  /** Volanta en monoespaciada del subtítulo. */
  kicker?: string;
  /** Línea principal del subtítulo. */
  line?: string;
  /** Chip de fecha/hora arriba a la derecha. */
  time?: string;
  /** false para escenas sin subtítulo (el cierre, por ejemplo). */
  captions?: boolean;
  children: ReactNode;
}

export function Frame({ clock, kicker, line, time, captions, children }: FrameProps) {
  const { t, len, p } = clock;
  const showCap = captions !== false && captionsFlag.on;
  const o = Math.min(clamp(t / FADE, 0, 1), clamp((len - t) / FADE, 0, 1));
  return (
    <div style={{ position: 'absolute', inset: 0, width: W, height: H, fontFamily: F.sans }}>
      <Backdrop p={p} />
      <div style={{ position: 'absolute', inset: 0, opacity: o }}>{children}</div>
      <ClockChip label={time} o={o} />
      <Caption kicker={kicker} line={line} o={o} show={showCap} />
      <div style={{ opacity: o }}>
        <Watermark />
      </div>
    </div>
  );
}
