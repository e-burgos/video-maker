import { Easing } from '../../../engine/api';
import { C, F, W, H, type ToneName } from '../../../theme';
import { MOTION, lerp, seg, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { PhotoSlot, type GlyphKind } from '../../../components/bits';
import { Panel, PageHeader, StatCard, Card } from '../components/webapp';
import { TV, Creative } from '../components/screen';

/* ACTO 4 — medición, cierre del día y llamada a la acción. */

interface KpiSpec {
  title: string;
  value: (g: number) => string;
  subtitle: string;
  tone: ToneName;
  glyph: GlyphKind;
}

const KPIS: KpiSpec[] = [
  { title: 'Reproducciones', value: (g) => Math.round(g * 14110).toLocaleString('es-AR'), subtitle: 'Últimos 30 días', tone: 'amber', glyph: 'camp' },
  { title: 'Horas en pantalla', value: (g) => `${Math.round(g * 386)} h`, subtitle: 'Tiempo de emisión', tone: 'sky', glyph: 'chart' },
  { title: 'Uptime de red', value: (g) => `${(g * 97.4).toFixed(1)}%`, subtitle: 'Disponibilidad media', tone: 'emerald', glyph: 'dash' },
  { title: 'Piezas con IA', value: (g) => `${Math.round(g * 23)}`, subtitle: 'Generadas este mes', tone: 'teal', glyph: 'ai' },
];

const TOP_CAMPANAS: { nombre: string; plays: number }[] = [
  { nombre: 'Menú del mediodía', plays: 4820 },
  { nombre: 'Desayuno del día', plays: 3960 },
  { nombre: 'Café helado −20%', plays: 2740 },
  { nombre: 'Noche de tapeo', plays: 1610 },
  { nombre: 'Promo mostrador', plays: 980 },
];

const MAX_PLAYS = 4820;

const POR_SUCURSAL: { nombre: string; h: number }[] = [
  { nombre: 'Centro', h: 0.95 },
  { nombre: 'Norte', h: 0.72 },
  { nombre: 'Sur', h: 0.58 },
  { nombre: 'Oeste', h: 0.34 },
];

/** 01:30 – 01:41 · Analíticas de reproducción. */
export function Medir() {
  const clock = useClock();
  const { t } = clock;
  const g = MOTION.draw(t, 0.8, 1.8);

  return (
    <Frame
      clock={clock}
      kicker="Y lo medís"
      line="Qué se reprodujo, en qué pantalla y a qué hora. La cartelería deja de ser una corazonada."
    >
      <div style={{ position: 'absolute', left: 200, top: 140, ...MOTION.enter(t, 0.1, 0.6, 20) }}>
        <Panel active="Analíticas" url="app.displayads.com.ar/analytics?tab=overview" w={1520} h={700}>
          <PageHeader title="Analíticas" subtitle="Reproducciones por campaña, dispositivo y período" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {KPIS.map((k, i) => (
              <div key={k.title} style={MOTION.enter(t, 0.4 + i * 0.12, 0.5, 16)}>
                <StatCard title={k.title} value={k.value(g)} subtitle={k.subtitle} tone={k.tone} glyph={k.glyph} />
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.6fr 1fr',
              gap: 18,
              flex: 1,
              minHeight: 0,
              ...MOTION.enter(t, 1.1, 0.6, 20),
            }}
          >
            <Card title="Top campañas por reproducciones">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
                {TOP_CAMPANAS.map((c, i) => {
                  const w = (c.plays / MAX_PLAYS) * 100 * MOTION.draw(t, 1.4 + i * 0.15, 0.9);
                  return (
                    <div key={c.nombre} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ width: 200, fontFamily: F.sans, fontSize: 15, color: C.dim, textAlign: 'right' }}>
                        {c.nombre}
                      </span>
                      <div style={{ flex: 1, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.045)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${w}%`,
                            borderRadius: 6,
                            background: `linear-gradient(90deg,${C.sky},${C.teal})`,
                          }}
                        />
                      </div>
                      <span style={{ width: 74, fontFamily: F.mono, fontSize: 15, color: C.text }}>
                        {c.plays.toLocaleString('es-AR')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Reproducciones por sucursal">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: '100%', paddingTop: 14 }}>
                {POR_SUCURSAL.map((s, i) => (
                  <div
                    key={s.nombre}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: `${s.h * 100 * MOTION.draw(t, 1.6 + i * 0.12, 0.9)}%`,
                        borderRadius: '8px 8px 4px 4px',
                        background: i === 0 ? `linear-gradient(180deg,${C.sky2},${C.sky})` : 'rgba(14,165,233,0.3)',
                        border: '1px solid rgba(14,165,233,0.4)',
                      }}
                    />
                    <span style={{ fontFamily: F.mono, fontSize: 13, color: C.dim2 }}>{s.nombre}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Panel>
      </div>
    </Frame>
  );
}

const AGENDA: { hora: string; campana: string; color: string }[] = [
  { hora: '08:00', campana: 'Desayuno del día', color: C.emerald },
  { hora: '12:00', campana: 'Menú del mediodía', color: C.amber },
  { hora: '20:00', campana: 'Noche de tapeo', color: C.sky2 },
];

/** 01:41 – 01:49 · Mismo encuadre que la apertura, pero al final del día. */
export function Noche() {
  const clock = useClock();
  const { t } = clock;
  // El zoom cierra el arco: arranca donde terminó la apertura y vuelve a 1.
  const zoom = lerp(1.06, 1, seg(t, 0, 8, Easing.easeInOutSine));

  return (
    <Frame
      clock={clock}
      time="lun 28 jul · 20:30"
      kicker="Mismo día, mismo local"
      line="Tres campañas, cuatro sucursales, cero visitas al local."
    >
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '58% 45%' }}>
        <PhotoSlot
          w={W}
          h={H}
          label="foto · la cafetería de noche (reemplazar)"
          radius={0}
          labelTop
          pad="170px 0 0 150px"
          style={{ position: 'absolute', inset: 0, opacity: 0.5 }}
        />
        <TV w={880} h={495} style={{ position: 'absolute', left: 720, top: 250 }}>
          <Creative kind="cena" scale={0.97} />
        </TV>
        <div style={{ position: 'absolute', left: 150, top: 300, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {AGENDA.map((a, i) => (
            <div
              key={a.hora}
              style={{ ...MOTION.enter(t, 0.6 + i * 0.5, 0.55, 16), display: 'flex', alignItems: 'center', gap: 18 }}
            >
              <span style={{ fontFamily: F.mono, fontSize: 22, color: a.color, width: 84 }}>{a.hora}</span>
              <span style={{ fontFamily: F.sans, fontSize: 30, fontWeight: 500, color: C.text }}>{a.campana}</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

const PLANES: { nombre: string; escala: string; ideal: string }[] = [
  { nombre: 'Starter', escala: '1 – 5 pantallas', ideal: 'Comercios independientes' },
  { nombre: 'Business', escala: 'Multi-sucursal', ideal: 'Cadenas y franquicias' },
  { nombre: 'Enterprise', escala: '100+ dispositivos', ideal: 'Analítica avanzada' },
];

/** 01:49 – 02:00 · Logo, tagline, planes y llamada a la acción. */
export function Cierre() {
  const clock = useClock();
  const { t } = clock;

  return (
    <Frame clock={clock} captions={false}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
        }}
      >
        <img
          src="/assets/logo.svg"
          alt="DisplayAds"
          style={{ height: 132, width: 'auto', ...MOTION.enter(t, 0.2, 0.7, 20) }}
        />

        <div
          style={{
            ...MOTION.enter(t, 0.9, 0.7, 22),
            fontFamily: F.sans,
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: C.text,
            textAlign: 'center',
          }}
        >
          Cada pantalla, bajo control.<span style={{ color: C.sky2 }}> Con IA.</span>
        </div>

        <div style={{ display: 'flex', gap: 22, marginTop: 14 }}>
          {PLANES.map((p, i) => (
            <div
              key={p.nombre}
              style={{
                ...MOTION.enter(t, 1.9 + i * 0.3, 0.55, 18),
                width: 330,
                padding: '24px 26px',
                borderRadius: 18,
                background: 'rgba(24,24,27,0.72)',
                border: `1px solid ${i === 1 ? 'rgba(14,165,233,0.4)' : C.line}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <span style={{ fontFamily: F.sans, fontSize: 26, fontWeight: 700, color: i === 1 ? C.sky2 : C.text }}>
                {p.nombre}
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 15, color: C.dim }}>{p.escala}</span>
              <span style={{ fontFamily: F.sans, fontSize: 17, color: C.dim2 }}>{p.ideal}</span>
            </div>
          ))}
        </div>

        <div style={{ ...MOTION.enter(t, 3.2, 0.6, 16), marginTop: 22, display: 'flex', alignItems: 'center', gap: 26 }}>
          <span
            style={{
              padding: '18px 34px',
              borderRadius: 999,
              background: C.sky,
              fontFamily: F.sans,
              fontSize: 24,
              fontWeight: 600,
              color: '#04121a',
            }}
          >
            Pedí una demo en vivo
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 22, color: C.dim, letterSpacing: '0.06em' }}>
            displayads.com.ar
          </span>
        </div>
      </div>
    </Frame>
  );
}
