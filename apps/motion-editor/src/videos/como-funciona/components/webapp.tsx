import type { CSSProperties, ReactNode } from 'react';
import { C, F, STAT_TONE, type ToneName } from '../../../theme';
import { Glyph, type GlyphKind } from '../../../components/bits';

/**
 * Recreación de la UI del panel (apps/webapp).
 *
 * Fuentes: apps/webapp/src/router/routes-config.tsx (navegación),
 * apps/webapp/src/pages/DashboardPage.tsx, AnalyticsPage.tsx,
 * libs/ui-components/src/components/StatCard.tsx y
 * apps/webapp/src/components/campaigns/planning/components/InteractiveTimelineV2.tsx
 */

export interface NavItem {
  name: string;
  icon: GlyphKind;
}

/** Ítems del menú lateral, en el mismo orden que el webapp. */
export const NAV: NavItem[] = [
  { name: 'Dashboard', icon: 'dash' },
  { name: 'Organización', icon: 'org' },
  { name: 'Campañas', icon: 'camp' },
  { name: 'IA', icon: 'ai' },
  { name: 'Analíticas', icon: 'chart' },
];

/** Ventana del navegador + sidebar del panel. */
export function Panel({
  active,
  url,
  children,
  w = 1520,
  h = 800,
  style,
}: {
  /** Nombre del ítem de NAV que queda resaltado. */
  active: string;
  url: string;
  children: ReactNode;
  w?: number;
  h?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 22,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: C.surf3,
        border: `1px solid ${C.line2}`,
        boxShadow: '0 42px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03) inset',
        ...style,
      }}
    >
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 20px',
          background: 'rgba(9,9,11,0.9)',
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 11, height: 11, borderRadius: 999, background: '#3f3f46' }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 460,
            height: 28,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.045)',
            border: `1px solid ${C.line}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.dim2 }}>{url}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div
          style={{
            width: 224,
            flexShrink: 0,
            background: 'rgba(9,9,11,0.72)',
            borderRight: `1px solid ${C.line}`,
            padding: '22px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <img
            src="/assets/logo.svg"
            alt=""
            style={{
              height: 34,
              width: 'auto',
              maxWidth: '100%',
              alignSelf: 'flex-start',
              objectFit: 'contain',
              margin: '2px 8px 20px',
              opacity: 0.95,
            }}
          />
          {NAV.map((n) => {
            const on = n.name === active;
            return (
              <div
                key={n.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 12px',
                  borderRadius: 12,
                  background: on ? 'rgba(14,165,233,0.13)' : 'transparent',
                  border: `1px solid ${on ? 'rgba(14,165,233,0.28)' : 'transparent'}`,
                }}
              >
                <Glyph kind={n.icon} color={on ? C.sky2 : C.dim2} />
                <span
                  style={{
                    fontFamily: F.sans,
                    fontSize: 16,
                    fontWeight: on ? 600 : 500,
                    color: on ? C.text : C.dim,
                  }}
                >
                  {n.name}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: '26px 30px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontFamily: F.sans,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: C.text,
        }}
      >
        {title}
      </div>
      <div style={{ fontFamily: F.sans, fontSize: 15, color: C.dim2 }}>{subtitle}</div>
    </div>
  );
}

/** StatCard — libs/ui-components/src/components/StatCard.tsx */
export function StatCard({
  title,
  value,
  subtitle,
  tone = 'indigo',
  glyph,
  style,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: ToneName;
  glyph: GlyphKind;
  style?: CSSProperties;
}) {
  const [fg, bg, bd] = STAT_TONE[tone];
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        padding: 18,
        background: 'rgba(24,24,27,0.72)',
        border: `1px solid ${C.line}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -24,
          right: -24,
          width: 96,
          height: 96,
          borderRadius: 999,
          background: bg,
          filter: 'blur(18px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: F.sans,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: C.dim,
          }}
        >
          {title}
        </span>
        <span
          style={{ padding: 8, borderRadius: 10, background: bg, border: `1px solid ${bd}`, display: 'flex' }}
        >
          <Glyph kind={glyph} color={fg} size={16} />
        </span>
      </div>
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: C.text,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontFamily: F.sans, fontSize: 12, color: C.dim2 }}>{subtitle}</span>
    </div>
  );
}

export function Card({
  title,
  children,
  style,
  pad = 18,
}: {
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
  pad?: number;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        background: 'rgba(24,24,27,0.6)',
        border: `1px solid ${C.line}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${C.line}`,
            fontFamily: F.sans,
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          padding: pad,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
}
