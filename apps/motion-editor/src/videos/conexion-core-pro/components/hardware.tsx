import type { CSSProperties, ReactNode } from 'react';
import { C, F } from '../../../theme';
import { Glyph } from '../../../components/bits';

/**
 * Piezas de hardware EXCLUSIVAS de `conexion-core-pro` (architect.md §2.1):
 * son diagramas propios del gabinete del Core Pro, no se promueven a
 * `src/components/` porque el video del Mostrador no los necesita (su
 * "pantalla de dispositivo" es el kiosco All-in-One, no una caja con
 * puertos). Construidas con primitivas del motor (rects, paths con
 * `pathLength`), nunca con fotografía ni ilustración dibujada a mano.
 *
 * Fidelidad de hardware (corrección del dueño, Ciclo 73 addendum): el
 * cliente NO recibe una placa a la vista — recibe una caja blanca y roja
 * con el logo de Display-Ads en la tapa (foto real en
 * `public/assets/core-device.webp`). Este diagrama representa la silueta de
 * esa caja: tapa blanca arriba, bisel frontal rojo abajo con los puertos,
 * en el mismo orden y lado que muestra la foto — USB-C de alimentación,
 * luego los dos HDMI de un lado; RJ45 y los 4 USB del otro (la foto los
 * muestra en el mismo borde, alrededor de la esquina redondeada de la
 * caja: acá se dibujan en una sola fila con un quiebre que sugiere esa
 * esquina). Por dentro sigue siendo una Raspberry Pi 5 — eso no cambia en
 * este comentario de código, sólo nunca se lo llama así en pantalla.
 */

export type PortKey = 'usbc' | 'hdmi0' | 'hdmi1' | 'eth' | 'usb1' | 'usb2' | 'usb3' | 'usb4';

const PORTS: { key: PortKey; label: string; left: number; w: number }[] = [
  { key: 'usbc', label: 'USB-C', left: 30, w: 34 },
  { key: 'hdmi0', label: 'HDMI', left: 104, w: 40 },
  { key: 'hdmi1', label: 'HDMI', left: 176, w: 40 },
  { key: 'eth', label: 'RJ45', left: 366, w: 56 },
  { key: 'usb1', label: 'USB', left: 440, w: 26 },
  { key: 'usb2', label: 'USB', left: 474, w: 26 },
  { key: 'usb3', label: 'USB', left: 508, w: 26 },
  { key: 'usb4', label: 'USB', left: 542, w: 26 },
];

/** El quiebre visual entre el grupo USB-C/HDMI y el grupo RJ45/USB, que
 * sugiere la esquina redondeada real de la caja (arranca después del
 * segundo HDMI y termina antes del RJ45). */
const CORNER_GAP = { left: 224, right: 358 };

/** Punto de salida de un puerto, en coordenadas locales de <CoreProCase>. */
export function portAnchor(key: PortKey): { x: number; y: number } {
  const port = PORTS.find((p) => p.key === key) ?? PORTS[0];
  return { x: port.left + port.w / 2, y: 230 };
}

/**
 * Diagrama del gabinete real del Core Pro: tapa blanca con la marca de
 * Display-Ads y bisel frontal rojo con los puertos, vista de frente.
 * `highlight` resalta un puerto puntual (el que la escena está explicando).
 */
export function CoreProCase({
  x = 0,
  y = 0,
  highlight,
  highlightNote,
  highlightProgress = 1,
  style,
}: {
  x?: number;
  y?: number;
  highlight?: PortKey;
  /** Aclaración de dónde está el puerto resaltado. Sin esto no se dibuja rótulo. */
  highlightNote?: string;
  /** 0→1: entrada del resaltado (usar MOTION.pop / MOTION.enter desde la escena). */
  highlightProgress?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 620, height: 230, ...style }}>
      {/* Tapa blanca del gabinete */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 620,
          height: 150,
          borderRadius: '18px 18px 0 0',
          background: 'linear-gradient(155deg,#fafafa,#e4e4e7)',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: 'inset 0 -10px 20px rgba(0,0,0,0.05)',
        }}
      />
      {/* La tapa va LIMPIA, sin marca: el isotipo dibujado con paths no
          reproducía el real y a este tamaño leía como un garabato. El equipo
          se reconoce por la silueta (tapa blanca + bisel rojo) y por la foto
          real de la escena de apertura. */}

      {/* Bisel frontal rojo, donde viven los puertos */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 150,
          width: 620,
          height: 80,
          borderRadius: '0 0 18px 18px',
          background: 'linear-gradient(155deg,#dc2626,#991b1b)',
          boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.35)',
        }}
      />
      {/* Quiebre que sugiere la esquina redondeada real de la caja */}
      <div
        style={{
          position: 'absolute',
          left: (CORNER_GAP.left + CORNER_GAP.right) / 2 - 1,
          top: 158,
          width: 2,
          height: 64,
          background: 'rgba(0,0,0,0.3)',
        }}
      />

      {/* Ícono de encendido, junto al puerto USB-C — igual que en la foto real */}
      <div style={{ position: 'absolute', left: 32, top: 158, opacity: 0.85 }}>
        <Glyph kind="power" color="#fecaca" size={14} />
      </div>

      {/* Puertos, alineados sobre el bisel */}
      {PORTS.map((p) => {
        const isHighlighted = highlight === p.key;
        return (
          <div key={p.key} style={{ position: 'absolute', left: p.left, top: 170, width: p.w }}>
            <div
              style={{
                width: p.w,
                height: 26,
                borderRadius: 3,
                background: '#0a0a0a',
                border: `1px solid ${isHighlighted ? C.sky2 : 'rgba(255,255,255,0.35)'}`,
                boxShadow: isHighlighted ? `0 0 14px ${C.sky2}` : 'none',
              }}
            />
            <span
              style={{
                position: 'absolute',
                top: 32,
                left: -6,
                width: p.w + 12,
                textAlign: 'center',
                fontFamily: F.mono,
                fontSize: 12,
                color: isHighlighted ? C.sky2 : 'rgba(255,255,255,0.75)',
              }}
            >
              {p.label}
            </span>
          </div>
        );
      })}

      {/* Rótulo del puerto resaltado. El texto lo pone la ESCENA: antes estaba
          fijo en "el más cercano al USB-C", así que el paso 2 —que resalta el
          RJ45— afirmaba una ubicación que no era la de su puerto. Se alinea a
          la derecha, terminando justo antes del puerto, para no quedar debajo
          del cable que baja de ahí. */}
      {highlight &&
        highlightNote &&
        (() => {
          // El rótulo se acuesta del lado donde entra: hacia la izquierda si el
          // puerto está a la derecha del gabinete, hacia la derecha si está
          // cerca del borde izquierdo (si no, el texto se cuelga fuera de la
          // caja). En los dos casos arranca al costado del cable que baja del
          // puerto, nunca debajo.
          const ax = portAnchor(highlight).x;
          const toLeft = ax > 260;
          const dot = (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: C.sky2,
                boxShadow: `0 0 10px ${C.sky2}`,
                flexShrink: 0,
              }}
            />
          );
          const label = (
            <span style={{ fontFamily: F.mono, fontSize: 15, color: C.sky2, whiteSpace: 'nowrap' }}>
              {highlightNote}
            </span>
          );
          return (
            <div
              style={{
                position: 'absolute',
                left: toLeft ? 0 : ax + 16,
                top: 246,
                width: toLeft ? ax - 10 : undefined,
                opacity: highlightProgress,
                transform: `translateY(${(1 - highlightProgress) * 14}px)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: toLeft ? 'flex-end' : 'flex-start',
                gap: 8,
              }}
            >
              {toLeft ? (
                <>
                  {label}
                  {dot}
                </>
              ) : (
                <>
                  {dot}
                  {label}
                </>
              )}
            </div>
          );
        })()}
    </div>
  );
}

/**
 * Ruteo ortogonal entre dos puntos: baja del puerto hasta un carril
 * horizontal, corre por ese carril y entra al destino en vertical. Las
 * esquinas se redondean con cuadráticas.
 *
 * Asume que el cable SALE HACIA ABAJO del origen (`lane > y1`), que es
 * siempre el caso acá: los puertos viven en el bisel frontal, en el borde
 * inferior del gabinete.
 */
function elbowPath(x1: number, y1: number, x2: number, y2: number, lane: number, r: number) {
  const sx = Math.sign(x2 - x1) || 1;
  const sy = Math.sign(y2 - lane) || 1;
  // El radio nunca puede comerse más de la mitad de un tramo, o el path se cruza.
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
 * Cable entre dos puntos, con `progress` 0→1 dibujado por `pathLength`
 * normalizado (sin medir el DOM, sin refs).
 *
 * El trazo es **ortogonal**, no curvo: un cable real cae del puerto, corre
 * derecho y sube al destino. La curva de bézier que había antes leía como
 * una manguera y cruzaba el dibujo en diagonal.
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
  drop = 78,
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
  const laneY = lane ?? y1 + drop;
  const d = elbowPath(x1, y1, x2, y2, laneY, 18);
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
 * Fuente oficial USB-C **enchufada a un tomacorriente de pared**.
 *
 * Se dibuja la escena completa (pared + tomacorriente + ficha + fuente) en
 * vez de un ladrillo suelto: el paso es "enchufalo", y un bloque flotando no
 * comunica dónde. El ancla del cable es el borde superior de la fuente, ver
 * `POWER_CABLE_ANCHOR`.
 */
export const POWER_OUTLET_SIZE = { w: 260, h: 150 };
/** Punto donde el cable USB-C sale de la fuente, relativo a <PowerOutlet>. */
export const POWER_CABLE_ANCHOR = { x: 196, y: 60 };

export function PowerOutlet({
  x = 0,
  y = 0,
  /** 0→1: la ficha entra al tomacorriente. */
  plugged = 1,
  style,
}: {
  x?: number;
  y?: number;
  plugged?: number;
  style?: CSSProperties;
}) {
  // La ficha arranca separada y entra: 18 px de recorrido, sin timers.
  const gap = (1 - plugged) * 18;

  return (
    <div
      style={{ position: 'absolute', left: x, top: y, width: POWER_OUTLET_SIZE.w, height: POWER_OUTLET_SIZE.h, ...style }}
    >
      {/* Chapa del tomacorriente sobre la pared */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 18,
          width: 104,
          height: 114,
          borderRadius: 14,
          background: 'linear-gradient(150deg,#f4f4f5,#d4d4d8)',
          border: '1px solid rgba(0,0,0,0.14)',
          boxShadow: '0 10px 26px rgba(0,0,0,0.45)',
        }}
      />
      {/* Los dos orificios + la toma de tierra */}
      <div style={{ position: 'absolute', left: 32, top: 44, width: 10, height: 26, borderRadius: 2, background: '#18181b' }} />
      <div style={{ position: 'absolute', left: 62, top: 44, width: 10, height: 26, borderRadius: 2, background: '#18181b' }} />
      <div style={{ position: 'absolute', left: 47, top: 84, width: 10, height: 20, borderRadius: 2, background: '#18181b' }} />

      {/* Fuente oficial: cuerpo + las dos patas que entran a la chapa */}
      <div style={{ position: 'absolute', left: 108 + gap, top: 22 }}>
        {/* patas */}
        <div style={{ position: 'absolute', left: -18, top: 22, width: 20, height: 8, borderRadius: 2, background: '#a1a1aa' }} />
        <div style={{ position: 'absolute', left: -18, top: 52, width: 20, height: 8, borderRadius: 2, background: '#a1a1aa' }} />
        {/* cuerpo */}
        <div
          style={{
            width: 106,
            height: 106,
            borderRadius: 16,
            background: 'linear-gradient(150deg,#52525b,#18181b)',
            border: `1px solid ${C.line2}`,
            boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Glyph kind="plug" color={C.sky2} size={24} />
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.dim, letterSpacing: '0.06em' }}>
            USB-C
          </span>
        </div>
        {/* boquilla por donde sale el cable, arriba a la derecha */}
        <div
          style={{
            position: 'absolute',
            left: 84,
            top: 30,
            width: 14,
            height: 20,
            borderRadius: 4,
            background: '#27272a',
            border: `1px solid ${C.line2}`,
          }}
        />
      </div>
    </div>
  );
}

/** Ancho/alto de <Router>, para que las escenas anclen el cable sin adivinar. */
export const ROUTER_SIZE = { w: 230, h: 150 };
/** Punto donde entra el cable de red (puerto LAN), relativo a <Router>. */
export const ROUTER_CABLE_ANCHOR = { x: 62, y: 150 };

/**
 * Router / módem del local: cuerpo con dos antenas, fila de LEDs y puertos
 * LAN abajo. Antes era una pastilla con una etiqueta adentro, que no leía
 * como un router — y el cliente tiene que reconocer el aparato que ya tiene
 * en el local.
 */
export function Router({ x = 0, y = 0, style }: { x?: number; y?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: ROUTER_SIZE.w, height: ROUTER_SIZE.h, ...style }}>
      {/* Antenas */}
      {[36, 172].map((left, i) => (
        <div key={left}>
          <div
            style={{
              position: 'absolute',
              left,
              top: 0,
              width: 8,
              height: 56,
              borderRadius: 999,
              background: 'linear-gradient(180deg,#52525b,#27272a)',
              transform: `rotate(${i === 0 ? -16 : 16}deg)`,
              transformOrigin: 'bottom center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: left - 1,
              top: -4,
              width: 10,
              height: 10,
              borderRadius: 999,
              background: '#52525b',
              transform: `rotate(${i === 0 ? -16 : 16}deg)`,
              transformOrigin: 'bottom center',
            }}
          />
        </div>
      ))}

      {/* Cuerpo */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 50,
          width: ROUTER_SIZE.w,
          height: 84,
          borderRadius: 14,
          background: 'linear-gradient(155deg,#3f3f46,#141417)',
          border: `1px solid ${C.line2}`,
          boxShadow: '0 16px 34px rgba(0,0,0,0.5)',
        }}
      />

      {/* Wifi + rótulo */}
      <div
        style={{
          position: 'absolute',
          left: 20,
          top: 66,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Glyph kind="wifi" color={C.sky2} size={24} />
        <span style={{ fontFamily: F.mono, fontSize: 15, color: C.dim, letterSpacing: '0.06em' }}>
          Router del local
        </span>
      </div>

      {/* LEDs de estado */}
      <div style={{ position: 'absolute', left: 22, top: 104, display: 'flex', gap: 10 }}>
        {[C.emerald, C.emerald, C.sky2].map((col, i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: col,
              boxShadow: `0 0 8px ${col}`,
            }}
          />
        ))}
      </div>

      {/* Puertos LAN en el frente: el primero es donde entra el cable */}
      <div style={{ position: 'absolute', left: 44, top: 128, display: 'flex', gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 28,
              height: 16,
              borderRadius: 3,
              background: '#0a0a0a',
              border: `1px solid ${i === 0 ? C.emerald : 'rgba(255,255,255,0.25)'}`,
              boxShadow: i === 0 ? `0 0 12px ${C.emerald}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * LED indicador. El parpadeo sale de `t` (reloj de la escena), nunca de un
 * timer: es una función determinista, igual que el `sin(2πp)` del Backdrop.
 */
export function LedDot({
  color,
  t,
  blink = false,
  size = 16,
  style,
}: {
  color: string;
  t: number;
  blink?: boolean;
  size?: number;
  style?: CSSProperties;
}) {
  const o = blink ? 0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI * 1.6)) : 1;
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        opacity: o,
        boxShadow: `0 0 ${size}px ${color}`,
        ...style,
      }}
    />
  );
}

/**
 * Tarjeta del hotspot de configuración del equipo: nombre de red +
 * contraseña ENMASCARADA (nunca un valor de ejemplo — CA-3 de HU-73-B-01).
 */
export function WifiHotspotCard({ ssid, style }: { ssid: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '24px 28px',
        borderRadius: 18,
        width: 520,
        background: 'rgba(24,24,27,0.75)',
        border: `1px solid ${C.line2}`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Glyph kind="wifi" color={C.sky2} size={24} />
        <span style={{ fontFamily: F.mono, fontSize: 26, fontWeight: 700, color: C.text }}>{ssid}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: F.mono, fontSize: 18, color: C.dim2 }}>Contraseña</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              style={{ width: 9, height: 9, borderRadius: 999, background: C.dim2, display: 'inline-block' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Simulación del panel web de configuración del equipo (`10.42.0.1`):
 * barra de dirección, listado de redes detectadas, opción manual, campo de
 * contraseña enmascarado y el botón de confirmación.
 */
export function BrowserConfigMock({
  networks,
  selected,
  passwordFilled,
  buttonPressed,
  style,
}: {
  networks: string[];
  /** Nombre de la red ya elegida por el cliente, o null si aún nadie tocó nada. */
  selected: string | null;
  passwordFilled: boolean;
  buttonPressed: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: 680,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${C.line2}`,
        background: '#0b0b0d',
        boxShadow: '0 30px 60px rgba(0,0,0,0.55)',
        ...style,
      }}
    >
      {/* barra de direcciones */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          background: '#151517',
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <span style={{ width: 11, height: 11, borderRadius: 999, background: '#3f3f46' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: '#3f3f46' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: '#3f3f46' }} />
        <div
          style={{
            marginLeft: 12,
            flex: 1,
            padding: '7px 14px',
            borderRadius: 8,
            background: '#0b0b0d',
            fontFamily: F.mono,
            fontSize: 17,
            color: C.dim,
          }}
        >
          http://10.42.0.1
        </div>
      </div>
      {/* listado de redes */}
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 14,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: C.dim2,
          }}
        >
          Redes disponibles
        </span>
        {networks.map((n) => {
          const isSel = n === selected;
          return (
            <div
              key={n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 10,
                background: isSel ? 'rgba(14,165,233,0.14)' : 'transparent',
                border: `1px solid ${isSel ? 'rgba(14,165,233,0.4)' : 'transparent'}`,
              }}
            >
              <Glyph kind="wifi" color={isSel ? C.sky2 : C.dim2} size={17} />
              <span style={{ fontFamily: F.sans, fontSize: 20, color: isSel ? C.text : C.dim }}>{n}</span>
            </div>
          );
        })}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderRadius: 10,
            color: C.dim2,
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 18 }}>[ Ingresar red manualmente… ]</span>
        </div>

        {selected && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 15, color: C.dim2, width: 110 }}>Contraseña</span>
              <div
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 8,
                  border: `1px solid ${C.line2}`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  gap: 6,
                }}
              >
                {passwordFilled &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <span
                      key={i}
                      style={{ width: 7, height: 7, borderRadius: 999, background: C.dim, display: 'inline-block' }}
                    />
                  ))}
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                alignSelf: 'flex-start',
                padding: '10px 22px',
                borderRadius: 10,
                background: buttonPressed ? C.sky : C.sky2,
                transform: buttonPressed ? 'scale(0.97)' : 'scale(1)',
              }}
            >
              <span style={{ fontFamily: F.sans, fontSize: 18, fontWeight: 600, color: '#04121b' }}>
                Conectar dispositivo
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Pantalla montada en el local, versión simplificada propia de este video. */
/** Punto donde entra el HDMI en la pantalla, relativo a <DeviceScreen>. */
export function screenCableAnchor(w: number, h: number) {
  return { x: 46, y: h + 24 };
}

export function DeviceScreen({
  w,
  h,
  style,
  fallback = false,
  /** true = dibuja pie y base, para que lea como un televisor y no como una lámina. */
  stand = false,
  /** true = muestra la entrada HDMI marcada en el borde inferior. */
  showInput = false,
  children,
}: {
  w: number;
  h: number;
  style?: CSSProperties;
  /** true = muestra el logo de respaldo en vez del contenido de la campaña. */
  fallback?: boolean;
  stand?: boolean;
  showInput?: boolean;
  children?: ReactNode;
}) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <div
        style={{
          width: w,
          height: h,
          padding: 12,
          borderRadius: 16,
          background: 'linear-gradient(160deg,#3a3a41,#141417)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 34px 70px rgba(0,0,0,0.6)',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
            // Un panel apagado no es negro puro: tiene un gris muy oscuro con
            // el reflejo de la sala. Sin esto lee como un agujero recortado.
            background: fallback || children ? '#000' : 'linear-gradient(160deg,#17171b,#0a0a0c 55%,#0e0e11)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Reflejo diagonal sutil sobre el vidrio */}
          {!fallback && !children && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(118deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0) 38%)',
              }}
            />
          )}
          {fallback ? (
            <span style={{ fontFamily: F.sans, fontSize: 24, fontWeight: 600, color: 'rgba(250,250,250,0.5)' }}>
              DisplayAds
            </span>
          ) : (
            children
          )}
        </div>

        {/* LED de standby del televisor */}
        <span
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 4,
            width: 6,
            height: 6,
            marginLeft: -3,
            borderRadius: 999,
            background: 'rgba(244,63,94,0.75)',
          }}
        />
      </div>

      {/* Entrada HDMI marcada, donde llega el cable */}
      {showInput && (
        <div
          style={{
            position: 'absolute',
            left: screenCableAnchor(w, h).x - 21,
            top: h + 2,
            width: 42,
            height: 20,
            borderRadius: 3,
            background: '#0a0a0a',
            border: `1px solid ${C.sky2}`,
            boxShadow: `0 0 12px ${C.sky2}`,
          }}
        />
      )}

      {/* Pie y base */}
      {stand && (
        <>
          <div
            style={{
              position: 'absolute',
              left: w / 2 - 26,
              top: h,
              width: 52,
              height: 46,
              background: 'linear-gradient(180deg,#2b2b31,#17171a)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: w / 2 - 130,
              top: h + 44,
              width: 260,
              height: 14,
              borderRadius: 7,
              background: 'linear-gradient(180deg,#3a3a41,#1b1b1f)',
              boxShadow: '0 16px 30px rgba(0,0,0,0.55)',
            }}
          />
        </>
      )}
    </div>
  );
}
