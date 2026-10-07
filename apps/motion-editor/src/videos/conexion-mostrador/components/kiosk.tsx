import type { CSSProperties, ReactNode } from 'react';
import { C, F } from '../../../theme';
import { Glyph } from '../../../components/bits';

/**
 * Piezas EXCLUSIVAS de `conexion-mostrador` (architect.md §2.1 + regla de la
 * Épica B: prohibido importar de `conexion-core-pro`, aunque el look se
 * parezca). Representan el Display-Ads Counter 15: pantalla All-in-One de
 * 15,6" con el reproductor integrado, montada en su soporte de mostrador —
 * nunca "tablet Android" en pantalla. En el panel de la organización el
 * equipo aparece listado como "Mostrador".
 *
 * HALLAZGO (no bloqueante): `Cable` de acá es una copia adaptada del
 * `Cable` de `conexion-core-pro/components/hardware.tsx` (mismo trazo con
 * `pathLength`, sin animación fuera del reloj). No se promovió a
 * `src/components/` en este ciclo porque sólo la usan estos dos videos y
 * cada uno la parametriza distinto (colores/curvatura); si aparece un
 * tercer video de conexión de hardware, ahí sí conviene promoverla.
 */

/**
 * Ruteo ortogonal: baja del equipo hasta un carril horizontal, corre por ese
 * carril y entra al destino en vertical. Esquinas redondeadas con cuadráticas.
 * Asume que el cable sale hacia abajo del origen (`lane > y1`).
 */
function elbowPath(x1: number, y1: number, x2: number, y2: number, lane: number, r: number) {
  const sx = Math.sign(x2 - x1) || 1;
  const sy = Math.sign(y2 - lane) || 1;
  const rr = Math.min(r, Math.abs(x2 - x1) / 2, Math.abs(lane - y1), Math.abs(y2 - lane) || r);
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${lane - rr}`,
    `Q ${x1} ${lane} ${x1 + sx * rr} ${lane}`,
    `L ${x2 - sx * rr} ${lane}`,
    `Q ${x2} ${lane} ${x2} ${lane + sy * rr}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

/**
 * Cable entre dos puntos, con `progress` 0→1 por `pathLength` normalizado.
 *
 * El trazo es **ortogonal**, no curvo (corrección del dueño, igual que en
 * `conexion-core-pro`): un cable real cae del equipo, corre derecho y sube al
 * destino. La bézier anterior leía como una manguera cruzando en diagonal.
 */
export function Cable({
  x1,
  y1,
  x2,
  y2,
  progress,
  color = C.sky2,
  width = 5,
  /** Cuánto baja el cable antes de correr en horizontal. */
  drop = 90,
  /** Y absoluto del carril horizontal; si se pasa, gana sobre `drop`. */
  lane,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number;
  color?: string;
  width?: number;
  drop?: number;
  lane?: number;
}) {
  const d = elbowPath(x1, y1, x2, y2, lane ?? y1 + drop, 18);
  return (
    <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <path
        d={d}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
        stroke={color}
        strokeWidth={width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={progress > 0 ? 1 : 0}
      />
    </svg>
  );
}

/**
 * Toma de corriente del local: chapa sobre la pared con sus orificios y la
 * ficha del cargador entrando. Antes era un cuadrado oscuro con un ícono, que
 * no leía como un tomacorriente — y el paso es literalmente "enchufalo".
 */
export const WALL_OUTLET_SIZE = { w: 210, h: 140 };
/** Punto donde el cable sale del cargador, relativo a <WallOutlet>. */
export const WALL_CABLE_ANCHOR = { x: 176, y: 58 };

export function WallOutlet({
  x = 0,
  y = 0,
  /** 0→1: la ficha entra a la chapa. */
  plugged = 1,
  style,
}: {
  x?: number;
  y?: number;
  plugged?: number;
  style?: CSSProperties;
}) {
  const gap = (1 - plugged) * 16;
  return (
    <div
      style={{ position: 'absolute', left: x, top: y, width: WALL_OUTLET_SIZE.w, height: WALL_OUTLET_SIZE.h, ...style }}
    >
      {/* Chapa */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 16,
          width: 96,
          height: 106,
          borderRadius: 13,
          background: 'linear-gradient(150deg,#f4f4f5,#d4d4d8)',
          border: '1px solid rgba(0,0,0,0.14)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
        }}
      />
      <div style={{ position: 'absolute', left: 29, top: 40, width: 9, height: 24, borderRadius: 2, background: '#18181b' }} />
      <div style={{ position: 'absolute', left: 57, top: 40, width: 9, height: 24, borderRadius: 2, background: '#18181b' }} />
      <div style={{ position: 'absolute', left: 43, top: 78, width: 9, height: 18, borderRadius: 2, background: '#18181b' }} />

      {/* Cargador oficial enchufado */}
      <div style={{ position: 'absolute', left: 100 + gap, top: 22 }}>
        <div style={{ position: 'absolute', left: -16, top: 20, width: 18, height: 7, borderRadius: 2, background: '#a1a1aa' }} />
        <div style={{ position: 'absolute', left: -16, top: 46, width: 18, height: 7, borderRadius: 2, background: '#a1a1aa' }} />
        <div
          style={{
            width: 90,
            height: 92,
            borderRadius: 14,
            background: 'linear-gradient(150deg,#52525b,#18181b)',
            border: `1px solid ${C.line2}`,
            boxShadow: '0 12px 26px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph kind="power" color={C.sky2} size={24} />
        </div>
      </div>
    </div>
  );
}

/** Alto que ocupa la base integrada por debajo del cuerpo de la tablet. */
const BASE_H = 62;
/** Grosor del marco blanco alrededor de la pantalla. */
const BEZEL = { x: 20, top: 46, bottom: 34 };

/** Tamaño total que ocupa <CounterKiosk> dado el alto de pantalla. */
export function counterKioskSize(w: number, h: number) {
  return { w: w + BEZEL.x * 2, h: h + BEZEL.top + BEZEL.bottom + BASE_H };
}

/** Punto de donde sale el cable de alimentación, relativo a <CounterKiosk>. */
export function counterCableAnchor(w: number, h: number) {
  const size = counterKioskSize(w, h);
  return { x: size.w - 26, y: size.h - BASE_H / 2 };
}

/**
 * Display-Ads Counter 15 (corrección del dueño, 2026-07-29, con foto real en
 * `public/assets/counter-15.webp`).
 *
 * NO es un monitor sobre un soporte de mostrador: es una **tablet vertical**
 * con la **base integrada al equipo**. El cliente no le monta ningún soporte
 * — la saca de la caja, la apoya y la enchufa. El diagrama anterior (pantalla
 * apaisada + cuello + base circular) representaba un producto que no existe y
 * mandaba a hacer un paso que no hay que hacer.
 *
 * De la foto real: cuerpo blanco vertical, marco parejo, cámara frontal
 * arriba al centro, y una base en cuña —parte del mismo equipo— con la
 * rejilla del parlante en su frente. `w`/`h` son la PANTALLA; el marco y la
 * base se suman alrededor (ver `counterKioskSize`).
 */
export function CounterKiosk({
  w = 300,
  h = 520,
  style,
  fallback = false,
  children,
}: {
  w?: number;
  h?: number;
  style?: CSSProperties;
  /** true = pantalla de respaldo con el logo, sin contenido de campaña. */
  fallback?: boolean;
  children?: ReactNode;
}) {
  const size = counterKioskSize(w, h);
  const bodyH = h + BEZEL.top + BEZEL.bottom;
  const baseW = size.w + 46;

  return (
    <div style={{ position: 'relative', width: size.w, height: size.h, ...style }}>
      {/* Base integrada: cuña que es parte del equipo, no un accesorio */}
      <div
        style={{
          position: 'absolute',
          left: (size.w - baseW) / 2,
          top: bodyH - 10,
          width: baseW,
          height: BASE_H,
          borderRadius: '14px 14px 18px 18px',
          background: 'linear-gradient(180deg,#fafafa,#c8c8cd)',
          border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: '0 26px 48px rgba(0,0,0,0.55)',
        }}
      />
      {/* Rejilla del parlante, en el frente de la base */}
      <div
        style={{
          position: 'absolute',
          left: (size.w - baseW) / 2 + 34,
          top: bodyH + BASE_H - 34,
          display: 'flex',
          gap: 5,
        }}
      >
        {Array.from({ length: 26 }).map((_, i) => (
          <span key={i} style={{ width: 3, height: 14, borderRadius: 2, background: 'rgba(0,0,0,0.22)' }} />
        ))}
      </div>

      {/* Cuerpo blanco de la tablet */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size.w,
          height: bodyH,
          borderRadius: 22,
          background: 'linear-gradient(160deg,#ffffff,#dcdce1)',
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        }}
      />
      {/* Cámara frontal */}
      <div
        style={{
          position: 'absolute',
          left: size.w / 2 - 6,
          top: 20,
          width: 12,
          height: 12,
          borderRadius: 999,
          background: '#3f3f46',
          border: '1px solid rgba(0,0,0,0.25)',
        }}
      />

      {/* Pantalla */}
      <div
        style={{
          position: 'absolute',
          left: BEZEL.x,
          top: BEZEL.top,
          width: w,
          height: h,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35)',
        }}
      >
        {fallback ? (
          <span style={{ fontFamily: F.sans, fontSize: 24, fontWeight: 600, color: 'rgba(250,250,250,0.5)' }}>
            DisplayAds
          </span>
        ) : (
          children
        )}
      </div>

      {/* Rótulo de producto, sobre el marco inferior */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: BEZEL.top + h + 9,
          width: size.w,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 12,
          letterSpacing: '0.14em',
          color: 'rgba(0,0,0,0.35)',
        }}
      >
        Counter 15
      </span>
    </div>
  );
}

/**
 * Aviso discreto de "Sin conexión — reintentando" (guía §2, primer minuto y
 * medio). El pulso del punto sale de `t`, nunca de un timer.
 */
export function RetryBadge({ t, style }: { t: number; style?: CSSProperties }) {
  const o = 0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI * 1.4));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 18px',
        borderRadius: 999,
        background: 'rgba(245,158,11,0.14)',
        border: `1px solid ${C.amber}`,
        ...style,
      }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: 999, background: C.amber, opacity: o, boxShadow: `0 0 10px ${C.amber}` }}
      />
      <span style={{ fontFamily: F.mono, fontSize: 16, color: C.amber, letterSpacing: '0.05em' }}>
        Sin conexión — reintentando
      </span>
    </div>
  );
}

/**
 * Pantalla de recuperación del propio equipo (no un navegador externo, a
 * diferencia del panel de configuración del Core Pro): lista de redes
 * cercanas, opción manual, contraseña ENMASCARADA y botón de confirmación.
 */
export function RecoveryPanel({
  networks,
  selected,
  passwordFilled,
  confirmed,
}: {
  networks: string[];
  /** Red ya elegida, o null si nadie tocó nada todavía. */
  selected: string | null;
  passwordFilled: boolean;
  confirmed: boolean;
}) {
  return (
    // En una pantalla vertical el panel arrancaba pegado arriba y dejaba medio
    // equipo en negro. Se centra verticalmente y los márgenes son parejos, así
    // el contenido queda compuesto dentro del marco y no colgando del borde.
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '34px 30px',
        gap: 18,
        background: 'linear-gradient(160deg,#141417,#0a0a0c)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Glyph kind="wifi" color={C.amber} size={22} />
        <span style={{ fontFamily: F.sans, fontSize: 22, fontWeight: 600, color: C.text }}>Reconectar Wi-Fi</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {networks.map((n) => {
          const isSel = n === selected;
          return (
            <div
              key={n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                background: isSel ? 'rgba(14,165,233,0.16)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isSel ? 'rgba(14,165,233,0.4)' : 'transparent'}`,
              }}
            >
              <Glyph kind="wifi" color={isSel ? C.sky2 : C.dim2} size={15} />
              <span style={{ fontFamily: F.sans, fontSize: 17, color: isSel ? C.text : C.dim }}>{n}</span>
            </div>
          );
        })}
        <div style={{ padding: '9px 12px', color: C.dim2, fontFamily: F.mono, fontSize: 14 }}>
          [ Ingresar red manualmente… ]
        </div>
      </div>

      {selected && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: F.mono, fontSize: 13, color: C.dim2, width: 96 }}>Contraseña</span>
            <div
              style={{
                flex: 1,
                height: 30,
                borderRadius: 6,
                border: `1px solid ${C.line2}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                gap: 5,
              }}
            >
              {passwordFilled &&
                Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    style={{ width: 6, height: 6, borderRadius: 999, background: C.dim, display: 'inline-block' }}
                  />
                ))}
            </div>
          </div>
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '9px 20px',
              borderRadius: 8,
              background: confirmed ? C.sky : C.sky2,
              transform: confirmed ? 'scale(0.97)' : 'scale(1)',
            }}
          >
            <span style={{ fontFamily: F.sans, fontSize: 16, fontWeight: 600, color: '#04121b' }}>Conectar</span>
          </div>
        </>
      )}
    </div>
  );
}
