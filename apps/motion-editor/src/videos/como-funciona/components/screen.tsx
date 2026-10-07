import type { CSSProperties, ReactNode } from 'react';
import { C, F } from '../../../theme';

/** La pantalla del local: bisel, marco y el chip de estado ONLINE. */
export function TV({
  w,
  h,
  children,
  style,
  live = true,
  glow = true,
}: {
  w: number;
  h: number;
  children: ReactNode;
  style?: CSSProperties;
  /** Chip "ONLINE" abajo a la derecha. */
  live?: boolean;
  /** Halo sky detrás del equipo. */
  glow?: boolean;
}) {
  return (
    <div style={{ position: 'relative', ...style }}>
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: -60,
            borderRadius: 40,
            background: 'radial-gradient(circle, rgba(14,165,233,0.14), rgba(14,165,233,0) 70%)',
            filter: 'blur(24px)',
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          width: w,
          height: h,
          padding: 12,
          borderRadius: 16,
          background: 'linear-gradient(160deg,#26262b,#111114)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 34px 70px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
            background: '#000',
          }}
        >
          {children}
        </div>
        {live && (
          <div
            style={{
              position: 'absolute',
              bottom: 22,
              right: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 10px',
              borderRadius: 999,
              background: 'rgba(9,9,11,0.72)',
              border: `1px solid ${C.line2}`,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.emerald }} />
            <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.12em', color: C.text }}>
              ONLINE
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export type CreativeKind = 'vencida' | 'desayuno' | 'almuerzo' | 'cena' | 'frias';

interface CreativeSpec {
  /** Volanta: franja horaria o etiqueta. */
  kicker: string;
  kickerColor: string;
  title: string;
  detail: string;
  bg: string;
}

/**
 * Las piezas publicitarias que se ven en las pantallas.
 * Para agregar una campaña nueva, sumá una entrada acá y usá su clave
 * en <Creative kind="...">.
 */
export const CREATIVES: Record<CreativeKind, CreativeSpec> = {
  vencida: {
    kicker: 'PROMO INVIERNO',
    kickerColor: 'rgba(250,250,250,0.5)',
    title: '2×1 en café',
    detail: 'válido hasta 30/06',
    bg: 'linear-gradient(140deg,#1d2b3a,#0b1620)',
  },
  desayuno: {
    kicker: '08:00 — 11:00',
    kickerColor: C.emerald,
    title: 'Desayuno del día',
    detail: 'Flat white + medialuna · $4.200',
    bg: 'linear-gradient(140deg,#0e2f3a,#06171d)',
  },
  almuerzo: {
    kicker: '11:00 — 15:00',
    kickerColor: C.amber,
    title: 'Menú del mediodía',
    detail: 'Plato + bebida + postre · $11.900',
    bg: 'linear-gradient(140deg,#2a1f0c,#170f05)',
  },
  cena: {
    kicker: '20:00 — 23:30',
    kickerColor: C.sky2,
    title: 'Noche de tapeo',
    detail: 'Tabla para dos + copa de vino',
    bg: 'linear-gradient(140deg,#161426,#08070f)',
  },
  frias: {
    kicker: 'GENERADA CON IA',
    kickerColor: C.teal,
    title: 'Café helado −20%',
    detail: 'Hoy, todo el día',
    bg: 'linear-gradient(140deg,#0b3a45,#061c22)',
  },
};

/**
 * Pieza en pantalla. Está diseñada sobre una pantalla de 900×506;
 * `scale` la adapta a otros tamaños sin recalcular tipografías
 * (0.71 para una TV de 640, 0.33 para una de 300, etc).
 */
export function Creative({
  kind,
  o = 1,
  scale = 1,
}: {
  kind: CreativeKind;
  /** Opacidad — se usa para los crossfades entre campañas. */
  o?: number;
  scale?: number;
}) {
  const c = CREATIVES[kind];
  const isPoster = kind === 'vencida';
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: o, overflow: 'hidden' }}>
      <div
        style={{
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 40,
            background: c.bg,
          }}
        >
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 15,
              letterSpacing: '0.22em',
              color: c.kickerColor,
            }}
          >
            {c.kicker}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isPoster ? 10 : 8 }}>
            <span
              style={{
                fontFamily: F.sans,
                fontSize: isPoster ? 58 : 56,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#fafafa',
                lineHeight: 1,
              }}
            >
              {c.title}
            </span>
            <span
              style={
                isPoster
                  ? { fontFamily: F.mono, fontSize: 17, color: 'rgba(250,250,250,0.55)' }
                  : { fontFamily: F.sans, fontSize: 24, color: 'rgba(250,250,250,0.7)' }
              }
            >
              {c.detail}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
