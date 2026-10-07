import { Easing } from '../../../engine/api';
import { C, F, type ToneName } from '../../../theme';
import { MOTION, lerp, seg, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { PhotoSlot, Cursor, type GlyphKind } from '../../../components/bits';
import { Panel, PageHeader, StatCard, Card } from '../components/webapp';
import { TV, Creative } from '../components/screen';

/* ACTO 2 — el producto: panel, carga de medios, programación y automatismo. */

interface KpiSpec {
  title: string;
  /** Recibe el progreso 0→1 del contador para animar el número. */
  value: (g: number) => string;
  subtitle: string;
  tone: ToneName;
  glyph: GlyphKind;
}

const KPIS: KpiSpec[] = [
  { title: 'Dispositivos', value: (g) => `${Math.round(g * 12)} / 14`, subtitle: 'Dispositivos en línea', tone: 'emerald', glyph: 'dash' },
  { title: 'Conectividad', value: (g) => `${Math.round(g * 86)}%`, subtitle: 'Tasa de conexión', tone: 'sky', glyph: 'chart' },
  { title: 'Campañas activas', value: (g) => `${Math.round(g * 5)}`, subtitle: 'En reproducción', tone: 'amber', glyph: 'camp' },
  { title: 'Medios', value: (g) => `${Math.round(g * 38)}`, subtitle: 'Archivos subidos', tone: 'indigo', glyph: 'org' },
  { title: 'Ubicaciones', value: (g) => `${Math.round(g * 4)}`, subtitle: 'Registradas', tone: 'teal', glyph: 'org' },
  { title: 'Offline', value: (g) => `${Math.round(g * 2)}`, subtitle: 'Sin conexión', tone: 'rose', glyph: 'dash' },
];

const CAMPANAS_RECIENTES: { nombre: string; estado: string; color: string }[] = [
  { nombre: 'Desayuno del día', estado: 'activa', color: C.emerald },
  { nombre: 'Menú del mediodía', estado: 'activa', color: C.emerald },
  { nombre: 'Noche de tapeo', estado: 'programada', color: C.dim2 },
  { nombre: '2×1 en café', estado: 'vencida', color: C.red },
];

const ALERTAS: { pantalla: string; detalle: string; critica: boolean }[] = [
  { pantalla: 'Pantalla Salón — Centro', detalle: 'Fuera de línea (offline)', critica: true },
  { pantalla: 'Vidriera — Norte', detalle: 'Orientación distinta a la campaña', critica: false },
];

/** 00:17 – 00:27 · El dashboard: todo el parque de pantallas en un panel. */
export function PanelScene() {
  const clock = useClock();
  const { t } = clock;
  const s = MOTION.pop(t, 0.15, 0.8);
  const up = MOTION.draw(t, 0.6, 1.6);

  return (
    <Frame
      clock={clock}
      kicker="Un solo panel"
      line="Todas tus pantallas, en tiempo real, desde el navegador o el celular."
    >
      <div style={{ position: 'absolute', left: 200, top: 128, transform: `scale(${s})`, transformOrigin: '50% 40%' }}>
        <Panel active="Dashboard" url="app.displayads.com.ar/home" w={1520} h={716}>
          <PageHeader title="Dashboard" subtitle="Resumen general de tu red de pantallas digitales" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14 }}>
            {KPIS.map((k, i) => (
              <div key={k.title} style={MOTION.enter(t, 0.5 + i * 0.1, 0.5, 16)}>
                <StatCard
                  title={k.title}
                  value={k.value(up)}
                  subtitle={k.subtitle}
                  tone={k.tone}
                  glyph={k.glyph}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 1fr 1fr',
              gap: 16,
              flex: 1,
              minHeight: 0,
              ...MOTION.enter(t, 1.5, 0.7, 22),
            }}
          >
            <Card title="Estado de dispositivos">
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 8 }}>
                <svg width="132" height="132" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="16" fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth="8" />
                  <circle
                    cx="21"
                    cy="21"
                    r="16"
                    fill="none"
                    stroke={C.emerald}
                    strokeWidth="8"
                    strokeDasharray={`${86 * up} 100`}
                    pathLength={100}
                    transform="rotate(-90 21 21)"
                  />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { l: 'En línea', n: 12, c: C.emerald },
                    { l: 'Offline', n: 2, c: C.red },
                  ].map((d) => (
                    <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: d.c }} />
                      <span style={{ fontFamily: F.sans, fontSize: 15, color: C.dim }}>{d.l}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 15, color: C.text }}>{d.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Campañas recientes">
              {CAMPANAS_RECIENTES.map((c) => (
                <div
                  key={c.nombre}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${C.line}`,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: c.color }} />
                  <span style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.text }}>{c.nombre}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: c.color, letterSpacing: '0.08em' }}>
                    {c.estado}
                  </span>
                </div>
              ))}
            </Card>

            <Card title="Alertas de Red y Pantallas">
              {ALERTAS.map((a) => (
                <div
                  key={a.pantalla}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '11px 13px',
                    borderRadius: 12,
                    background: a.critica ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${a.critica ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'}`,
                  }}
                >
                  <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 600, color: C.text }}>
                    {a.pantalla}
                  </span>
                  <span style={{ fontFamily: F.sans, fontSize: 12, color: a.critica ? '#fca5a5' : '#fcd34d' }}>
                    {a.detalle}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        </Panel>
      </div>
    </Frame>
  );
}

const MEDIOS: { nombre: string; meta: string }[] = [
  { nombre: 'Desayuno del día', meta: 'JPG · 1920×1080' },
  { nombre: 'Flat white', meta: 'MP4 · 12 s' },
  { nombre: 'Medialunas', meta: 'JPG · 1920×1080' },
  { nombre: 'Menú mediodía', meta: 'JPG · 1920×1080' },
];

/** 00:27 – 00:37 · Subir la pieza y verla aparecer en la pantalla del local. */
export function Manana() {
  const clock = useClock();
  const { t } = clock;
  const move = seg(t, 1.2, 1.5, Easing.easeInOutCubic);
  const cx = lerp(1090, 560, move);
  const cy = lerp(620, 430, move);
  const click = seg(t, 2.7, 0.55);
  const sent = MOTION.draw(t, 3.6, 1.2);

  return (
    <Frame
      clock={clock}
      time="lun 28 jul · 08:00"
      kicker="Cargás una vez"
      line="Subís la pieza, elegís la campaña y la pantalla ya la está reproduciendo."
    >
      <div style={{ position: 'absolute', left: 128, top: 170 }}>
        <Panel active="Campañas" url="app.displayads.com.ar/campaigns?tab=media" w={980} h={640}>
          <PageHeader title="Medios" subtitle="Biblioteca de contenido de tu organización" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {MEDIOS.map((m, i) => {
              const seleccionada = i === 0 && click > 0.4;
              return (
                <div
                  key={m.nombre}
                  style={{
                    ...MOTION.enter(t, 0.3 + i * 0.12, 0.5, 14),
                    borderRadius: 14,
                    overflow: 'hidden',
                    border: `1px solid ${seleccionada ? 'rgba(14,165,233,0.55)' : C.line}`,
                    background: 'rgba(24,24,27,0.6)',
                    boxShadow: seleccionada ? '0 0 0 3px rgba(14,165,233,0.18)' : 'none',
                  }}
                >
                  <PhotoSlot
                    w="100%"
                    h={132}
                    label={`pieza · ${m.nombre.toLowerCase()}`}
                    radius={0}
                    style={{ borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
                  />
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 600, color: C.text }}>
                      {m.nombre}
                    </span>
                    <span style={{ fontFamily: F.mono, fontSize: 12, color: C.dim2 }}>{m.meta}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Cursor x={cx - 128} y={cy - 170} click={click < 1 ? click : 0} />
      </div>

      <div style={{ position: 'absolute', right: 130, top: 300 }}>
        <TV w={640} h={360}>
          <Creative kind="desayuno" o={sent} scale={0.71} />
          <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', opacity: 1 - sent }} />
        </TV>
        <div
          style={{
            marginTop: 26,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: MOTION.draw(t, 4.4, 0.6),
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: C.emerald,
              boxShadow: `0 0 14px ${C.emerald}`,
            }}
          />
          <span style={{ fontFamily: F.mono, fontSize: 19, color: C.text, letterSpacing: '0.06em' }}>
            Pantalla Salón — Centro · actualizada en 38 s
          </span>
        </div>
      </div>
    </Frame>
  );
}

/* ── Timeline de campañas (InteractiveTimelineV2 del webapp) ── */

const HORAS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];

type BarTone = 'em' | 'am' | 'sk' | 'cf';

/** [texto, borde, fondo] por tono de barra. */
const BAR_TONE: Record<BarTone, [string, string, string]> = {
  em: ['rgba(52,211,153,0.16)', 'rgba(52,211,153,0.42)', '#6ee7b7'],
  am: ['rgba(245,158,11,0.16)', 'rgba(245,158,11,0.42)', '#fcd34d'],
  sk: ['rgba(14,165,233,0.16)', 'rgba(14,165,233,0.42)', '#7dd3fc'],
  cf: ['rgba(239,68,68,0.16)', 'rgba(239,68,68,0.45)', '#fca5a5'],
};

interface Bar {
  /** Índice de la fila de dispositivo (contando sólo dispositivos). */
  row: number;
  /** Columna de inicio y fin, en índices de HORAS. */
  s: number;
  e: number;
  label: string;
  tone: BarTone;
  /** Segundo del reloj local en que empieza a dibujarse. */
  at: number;
}

const BARS: Bar[] = [
  { row: 0, s: 0, e: 3, label: 'Desayuno del día', tone: 'em', at: 0.5 },
  { row: 0, s: 3, e: 7, label: 'Menú del mediodía', tone: 'am', at: 0.9 },
  { row: 0, s: 7, e: 12, label: 'Cafetería tarde', tone: 'sk', at: 1.3 },
  { row: 1, s: 0, e: 3, label: 'Desayuno del día', tone: 'em', at: 1.6 },
  { row: 1, s: 3, e: 7, label: 'Menú del mediodía', tone: 'am', at: 1.9 },
  { row: 2, s: 4, e: 9, label: 'Promo mostrador', tone: 'sk', at: 2.2 },
  { row: 3, s: 0, e: 5, label: 'Desayuno del día', tone: 'em', at: 2.5 },
  { row: 3, s: 3, e: 8, label: 'Menú del mediodía', tone: 'cf', at: 2.8 },
  { row: 4, s: 6, e: 13, label: 'Cafetería tarde', tone: 'sk', at: 3.1 },
];

const SUCURSALES: { loc: string; devices: string[] }[] = [
  { loc: 'SUCURSAL CENTRO', devices: ['Pantalla Salón', 'Vidriera calle', 'Mostrador'] },
  { loc: 'SUCURSAL NORTE', devices: ['Pantalla Salón', 'Vidriera calle'] },
];

type Row = { group: string; n: number } | { device: string };

const COL_W = 74;
const LABEL_W = 260;
const ROW_H = 62;

/** 00:37 – 00:49 · Programación por franja horaria y detección de solapamientos. */
export function Timeline() {
  const clock = useClock();
  const { t } = clock;
  const alert = MOTION.enter(t, 4.2, 0.6, 14);

  const rows: Row[] = [];
  for (const s of SUCURSALES) {
    rows.push({ group: s.loc, n: s.devices.length });
    for (const d of s.devices) rows.push({ device: d });
  }

  let deviceIndex = -1;

  return (
    <Frame
      clock={clock}
      kicker="Programación, no un loop"
      line="Por franja horaria, por día y por sucursal. El sistema avisa si dos campañas se solapan."
    >
      <div
        style={{
          position: 'absolute',
          left: 148,
          top: 150,
          width: LABEL_W + COL_W * HORAS.length,
          borderRadius: 20,
          overflow: 'hidden',
          background: 'rgba(12,12,14,0.86)',
          border: `1px solid ${C.line2}`,
          boxShadow: '0 40px 90px rgba(0,0,0,0.6)',
          ...MOTION.enter(t, 0.1, 0.6, 20),
        }}
      >
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, background: 'rgba(9,9,11,0.92)' }}>
          <div style={{ width: LABEL_W, flexShrink: 0, padding: '14px 18px', borderRight: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.24em', color: C.dim2 }}>
              PANTALLAS
            </span>
          </div>
          {HORAS.map((h) => (
            <div key={h} style={{ width: COL_W, textAlign: 'center', padding: '14px 0', borderLeft: `1px solid ${C.line}` }}>
              <span style={{ fontFamily: F.mono, fontSize: 14, color: C.dim }}>{h}</span>
            </div>
          ))}
        </div>

        {rows.map((r, i) => {
          if ('group' in r) {
            return (
              <div key={`g${i}`} style={{ display: 'flex', background: 'rgba(9,9,11,0.7)', borderBottom: `1px solid ${C.line}` }}>
                <div
                  style={{
                    width: LABEL_W,
                    padding: '10px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRight: `1px solid ${C.line}`,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: C.sky }} />
                  <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', color: C.dim }}>
                    {r.group}
                  </span>
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.07)',
                      color: C.dim,
                    }}
                  >
                    {r.n}
                  </span>
                </div>
                <div style={{ flex: 1 }} />
              </div>
            );
          }

          deviceIndex += 1;
          const misBarras = BARS.filter((b) => b.row === deviceIndex);
          return (
            <div key={`d${i}`} style={{ display: 'flex', height: ROW_H, borderBottom: `1px solid ${C.line}` }}>
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  padding: '0 18px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRight: `1px solid ${C.line}`,
                }}
              >
                <span style={{ fontFamily: F.sans, fontSize: 15, color: C.text }}>{r.device}</span>
              </div>
              <div style={{ position: 'relative', flex: 1 }}>
                {HORAS.map((h, hi) => (
                  <div key={h} style={{ position: 'absolute', left: hi * COL_W, top: 0, bottom: 0, width: 1, background: C.line }} />
                ))}
                {misBarras.map((b) => {
                  const g = MOTION.draw(t, b.at, 0.7);
                  const [bg, bd, fg] = BAR_TONE[b.tone];
                  return (
                    <div
                      key={`${b.label}${b.s}`}
                      style={{
                        position: 'absolute',
                        left: b.s * COL_W + 4,
                        top: 12,
                        height: ROW_H - 24,
                        width: ((b.e - b.s) * COL_W - 8) * g,
                        borderRadius: 8,
                        background: bg,
                        border: `1px solid ${bd}`,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 12,
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: F.sans,
                          fontSize: 13,
                          fontWeight: 600,
                          color: fg,
                          whiteSpace: 'nowrap',
                          opacity: g > 0.6 ? 1 : 0,
                        }}
                      >
                        {b.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 120,
          top: 706,
          width: 470,
          ...alert,
          padding: '18px 22px',
          borderRadius: 16,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.32)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <span style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: '0.18em', color: '#fca5a5' }}>
          SOLAPAMIENTO DETECTADO
        </span>
        <span style={{ fontFamily: F.sans, fontSize: 19, color: C.text }}>
          Norte · Pantalla Salón — 11:00 a 13:00 con dos campañas activas.
        </span>
      </div>
    </Frame>
  );
}

const SATELITES: { nombre: string; delay: number }[] = [
  { nombre: 'Norte · Vidriera', delay: 0.4 },
  { nombre: 'Sur · Salón', delay: 0.7 },
  { nombre: 'Centro · Mostrador', delay: 1.0 },
];

/** 00:49 – 00:58 · A las 12:00 la franja cambia sola en todos los locales. */
export function Mediodia() {
  const clock = useClock();
  const { t } = clock;
  const flip = seg(t, 2.2, 0.9, Easing.easeInOutCubic);
  const hora = t < 2.2 ? '11:59' : '12:00';

  return (
    <Frame
      clock={clock}
      time={`lun 28 jul · ${hora}`}
      kicker="Cambia solo"
      line="A las 12:00 la franja del mediodía entra en todas las sucursales. Nadie toca nada."
    >
      <div style={{ position: 'absolute', left: 150, top: 240 }}>
        <TV w={900} h={506}>
          <Creative kind="desayuno" o={1 - flip} />
          <Creative kind="almuerzo" o={flip} />
        </TV>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 250,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {SATELITES.map((s, i) => {
          const f = seg(t, 2.4 + s.delay, 0.7, Easing.easeInOutCubic);
          return (
            <div
              key={s.nombre}
              style={{ ...MOTION.enter(t, 0.4 + i * 0.2, 0.5, 16), display: 'flex', alignItems: 'center', gap: 20 }}
            >
              <TV w={300} h={169} live={false} glow={false}>
                <Creative kind="desayuno" o={1 - f} scale={0.334} />
                <Creative kind="almuerzo" o={f} scale={0.334} />
              </TV>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: F.sans, fontSize: 19, fontWeight: 600, color: C.text }}>{s.nombre}</span>
                <span style={{ fontFamily: F.mono, fontSize: 14, color: f > 0.5 ? C.emerald : C.dim2 }}>
                  {f > 0.5 ? 'sincronizada' : 'esperando'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
