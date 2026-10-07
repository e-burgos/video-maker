import type { CSSProperties } from 'react';
import { C, F } from '../theme';

/**
 * Hueco de fotografía.
 *
 * Sin `src` dibuja el placeholder rayado con la etiqueta en monoespaciada que
 * dice qué material falta. Con `src` muestra la foto real: es el mismo hueco,
 * así que reemplazar un placeholder por material definitivo es agregar una
 * prop, no reescribir la escena.
 *
 * Los lineamientos visuales piden fotografía real de negocios, no ilustración
 * vectorial — el placeholder es un pendiente, no una decisión de estilo.
 *
 * El exportador precachea toda `<img>` del stage como `data:` URL antes de
 * serializar el frame (ver `src/editor/exportVideo.ts`): la ruta tiene que ser
 * del mismo origen, servida desde `public/`.
 *
 * OJO CON EL PESO: esa `data:` URL se re-serializa dentro del svg en CADA
 * frame del export, así que el archivo entra completo 30 veces por segundo.
 * Una foto de 1,1 MB agrega ~1,5 MB por frame — más de lo que se ahorró
 * recortando las fuentes. Usá **WebP** y el tamaño mínimo que sirva: la misma
 * foto quedó en 57 KB (75 KB ya codificada) sin diferencia visible, verificado
 * rasterizando ambas dentro del `foreignObject`.
 */
export function PhotoSlot({
  w,
  h,
  label,
  src,
  style,
  radius = 20,
  labelTop = false,
  pad = '18px 22px',
  fit = 'cover',
}: {
  w: number | string;
  h: number | string;
  label: string;
  /** Ruta de la foto real bajo `public/`. Sin esto, se dibuja el placeholder. */
  src?: string;
  style?: CSSProperties;
  radius?: number;
  /** true = etiqueta arriba (para recuadros a sangre). */
  labelTop?: boolean;
  pad?: string;
  fit?: 'cover' | 'contain';
}) {
  if (src) {
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: radius,
          overflow: 'hidden',
          border: `1px solid ${C.line2}`,
          background: '#0f1115',
          ...style,
        }}
      >
        <img
          src={src}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${C.line2}`,
        background: 'repeating-linear-gradient(115deg, #14161a 0 14px, #0f1115 14px 28px)',
        display: 'flex',
        alignItems: labelTop ? 'flex-start' : 'flex-end',
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 15,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(250,250,250,0.42)',
          padding: pad,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export type GlyphKind =
  | 'dash'
  | 'org'
  | 'camp'
  | 'ai'
  | 'chart'
  | 'wifi'
  | 'check'
  | 'plug'
  | 'alert'
  | 'power';

/**
 * Íconos de la navegación y de las StatCards.
 * A propósito son geometría simple (cuadrados, círculos, barras,
 * triángulos) en vez de ilustraciones dibujadas a mano.
 */
export function Glyph({
  kind,
  color,
  size = 18,
}: {
  kind: GlyphKind;
  color: string;
  size?: number;
}) {
  const s: CSSProperties = { width: size, height: size, display: 'block' };
  switch (kind) {
    case 'dash':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <rect width="8" height="8" rx="2" fill={color} />
          <rect x="10" width="8" height="5" rx="2" fill={color} opacity=".55" />
          <rect x="10" y="7" width="8" height="11" rx="2" fill={color} opacity=".55" />
          <rect y="10" width="8" height="8" rx="2" fill={color} opacity=".55" />
        </svg>
      );
    case 'org':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <rect x="1" y="2" width="10" height="14" rx="2" fill={color} opacity=".55" />
          <rect x="12" y="7" width="5" height="9" rx="1.5" fill={color} />
        </svg>
      );
    case 'camp':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <path d="M2 9 L14 3 L14 15 Z" fill={color} />
          <rect x="15" y="7" width="3" height="4" rx="1.5" fill={color} opacity=".55" />
        </svg>
      );
    case 'ai':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="7" fill="none" stroke={color} strokeWidth="1.8" />
          <circle cx="9" cy="9" r="2.6" fill={color} />
        </svg>
      );
    case 'chart':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <rect y="10" width="4" height="8" rx="1.4" fill={color} opacity=".55" />
          <rect x="7" y="5" width="4" height="13" rx="1.4" fill={color} />
          <rect x="14" y="1" width="4" height="17" rx="1.4" fill={color} opacity=".55" />
        </svg>
      );
    case 'wifi':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <path d="M2 7 Q9 1 16 7" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity=".45" />
          <path d="M4.6 10 Q9 6 13.4 10" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity=".75" />
          <circle cx="9" cy="14" r="2" fill={color} />
        </svg>
      );
    case 'check':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <path d="M3 9.5 L7.2 13.5 L15 4.5" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'plug':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <rect x="6" y="1" width="2.2" height="6" rx="1" fill={color} />
          <rect x="9.8" y="1" width="2.2" height="6" rx="1" fill={color} />
          <path d="M3 7 H15 V10 A6 6 0 0 1 3 10 Z" fill="none" stroke={color} strokeWidth="1.8" />
          <rect x="7.9" y="15" width="2.2" height="2.6" fill={color} opacity=".55" />
        </svg>
      );
    case 'alert':
      return (
        <svg style={s} viewBox="0 0 18 18">
          <path d="M9 2 L17 16 H1 Z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
          <rect x="8.1" y="7" width="1.8" height="5" rx="0.9" fill={color} />
          <circle cx="9" cy="14" r="1.1" fill={color} />
        </svg>
      );
    case 'power':
      // Símbolo de encendido estándar (círculo abierto + trazo vertical),
      // igual al que trae serigrafiado el puerto USB-C del Core Pro real.
      return (
        <svg style={s} viewBox="0 0 18 18">
          <path
            d="M5 5.2 A7 7 0 1 0 13 5.2"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect x="8.1" y="1.5" width="1.8" height="7" rx="0.9" fill={color} />
        </svg>
      );
  }
}

/**
 * Numerador de pasos genérico ("Paso 1", "Paso 2"…) para instructivos de
 * conexión de equipos. Promovido a compartido (architect.md §2.1): tanto
 * `conexion-core-pro` como `conexion-mostrador` necesitan la misma
 * pieza para enumerar pasos físicos.
 */
export function StepNumber({
  n,
  color = C.sky2,
  size = 56,
  style,
}: {
  n: number;
  color?: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `2px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: F.mono,
          fontSize: size * 0.42,
          fontWeight: 700,
          color,
        }}
      >
        {n}
      </span>
    </div>
  );
}

export type NoteTone = 'amber' | 'sky' | 'emerald';

const NOTE_TONE: Record<NoteTone, { fg: string; bg: string; border: string }> = {
  amber: { fg: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
  sky: { fg: '#38bdf8', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.35)' },
  emerald: { fg: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)' },
};

/**
 * Tarjeta de advertencia / aclaración para instructivos de conexión.
 * Promovida a compartido (architect.md §2.1): la usan tanto el aviso de
 * "la contraseña es única de cada equipo" (conexion-core-pro) como los
 * avisos de conexion-mostrador.
 */
export function NoteCard({
  icon = 'alert',
  tone = 'amber',
  title,
  text,
  w = 640,
  style,
}: {
  icon?: GlyphKind;
  tone?: NoteTone;
  title: string;
  text: string;
  w?: number | string;
  style?: CSSProperties;
}) {
  const t = NOTE_TONE[tone];
  return (
    <div
      style={{
        width: w,
        display: 'flex',
        gap: 18,
        alignItems: 'flex-start',
        padding: '20px 24px',
        borderRadius: 16,
        background: t.bg,
        border: `1px solid ${t.border}`,
        ...style,
      }}
    >
      <div style={{ marginTop: 2 }}>
        <Glyph kind={icon} color={t.fg} size={26} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 600, color: C.text }}>{title}</span>
        <span style={{ fontFamily: F.sans, fontSize: 22, color: C.dim, lineHeight: 1.35 }}>{text}</span>
      </div>
    </div>
  );
}

/** Puntero con anillo de click. `click` va de 0 a 1 durante el clic. */
export function Cursor({
  x,
  y,
  o = 1,
  click = 0,
}: {
  x: number;
  y: number;
  o?: number;
  click?: number;
}) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: o, pointerEvents: 'none' }}>
      {click > 0 && (
        <span
          style={{
            position: 'absolute',
            left: -18,
            top: -18,
            width: 36 + click * 34,
            height: 36 + click * 34,
            marginLeft: -click * 17,
            marginTop: -click * 17,
            borderRadius: 999,
            border: `2px solid rgba(14,165,233,${0.55 * (1 - click)})`,
          }}
        />
      )}
      <svg
        width="30"
        height="30"
        viewBox="0 0 30 30"
        style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))' }}
      >
        <path
          d="M4 2 L4 22 L10 16.5 L14 25 L18 23 L14 15 L22 15 Z"
          fill="#fafafa"
          stroke="#09090b"
          strokeWidth="1.4"
        />
      </svg>
    </div>
  );
}
