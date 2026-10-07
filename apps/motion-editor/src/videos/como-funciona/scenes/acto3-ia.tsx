import { clamp } from '../../../engine/api';
import { C, F } from '../../../theme';
import { MOTION, seg, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { PhotoSlot, Cursor } from '../../../components/bits';
import { Panel, PageHeader } from '../components/webapp';
import { TV, Creative } from '../components/screen';

/* ACTO 3 — la IA, la publicación masiva y el costo del hardware. */

const SUGERENCIAS: { fuente: string; texto: string; color: string }[] = [
  { fuente: 'CLIMA · CÓRDOBA', texto: 'Mañana 34 °C — activá “Café helado” de 11 a 19 h.', color: C.sky },
  { fuente: 'CALENDARIO', texto: 'Martes feriado: adelantá la campaña de gastronomía al domingo.', color: C.teal },
  { fuente: 'COMPETENCIA · 180 m', texto: 'Abrió una cafetería nueva en Palermo. Mensaje diferenciador sugerido.', color: C.amber },
];

const PROMPT = 'promo de café helado con 20% de descuento, estética moderna, colores cálidos';

/** 00:58 – 01:11 · La IA sugiere con contexto local y genera la pieza. */
export function IA() {
  const clock = useClock();
  const { t } = clock;
  const typed = PROMPT.slice(0, Math.floor(seg(t, 4.0, 3.0) * PROMPT.length));
  const gen = MOTION.draw(t, 7.4, 1.4);
  const done = MOTION.draw(t, 9.0, 0.8);

  return (
    <Frame
      clock={clock}
      kicker="La IA como consultor"
      line="Sugiere qué mostrar con el clima y los feriados de tu zona — y genera la pieza."
    >
      <div style={{ position: 'absolute', left: 140, top: 156 }}>
        <Panel active="IA" url="app.displayads.com.ar/ai?tab=suggestions" w={860} h={660}>
          <PageHeader title="Asistente IA" subtitle="Sugerencias automáticas y generación de contenido" />

          {SUGERENCIAS.map((s, i) => (
            <div
              key={s.fuente}
              style={{
                ...MOTION.enter(t, 0.4 + i * 0.5, 0.55, 18),
                padding: '16px 18px',
                borderRadius: 14,
                background: 'rgba(24,24,27,0.7)',
                border: `1px solid ${C.line}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: '0.18em', color: s.color }}>
                {s.fuente}
              </span>
              <span style={{ fontFamily: F.sans, fontSize: 19, color: C.text, lineHeight: 1.25 }}>{s.texto}</span>
            </div>
          ))}

          <div
            style={{
              ...MOTION.enter(t, 3.4, 0.5, 16),
              marginTop: 'auto',
              padding: '16px 18px',
              borderRadius: 14,
              background: 'rgba(9,9,11,0.8)',
              border: `1px solid ${C.line2}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <span style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: '0.18em', color: C.dim2 }}>
              GENERAR IMAGEN
            </span>
            <span style={{ fontFamily: F.sans, fontSize: 18, color: C.text, minHeight: 52, lineHeight: 1.3 }}>
              {typed}
              <span style={{ opacity: t > 4 && t < 7.2 ? 1 : 0, color: C.sky2 }}>|</span>
            </span>
            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${gen * 100}%`, background: `linear-gradient(90deg,${C.sky},${C.teal})` }} />
            </div>
          </div>
        </Panel>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 130,
          top: 290,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ position: 'relative' }}>
          <PhotoSlot w={620} h={349} label="salida del generador · gemini" />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', opacity: done }}>
            <Creative kind="frias" scale={0.69} />
          </div>
          {/* barrido de generación */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${gen * 100}%`,
              height: 2,
              background: C.sky2,
              opacity: gen > 0 && gen < 1 ? 1 : 0,
              boxShadow: `0 0 20px ${C.sky2}`,
            }}
          />
        </div>
        <span style={{ fontFamily: F.mono, fontSize: 17, color: done > 0.5 ? C.emerald : C.dim2, letterSpacing: '0.06em' }}>
          {done > 0.5 ? 'lista para publicar · 31 s' : 'generando…'}
        </span>
      </div>
    </Frame>
  );
}

/** Las 14 pantallas de la red, como grilla de puntos. */
const DOTS = Array.from({ length: 14 }, (_, i) => ({
  x: 120 + (i % 7) * 118,
  y: 90 + Math.floor(i / 7) * 132,
  delay: 0.06 * i,
}));

/** 01:11 – 01:21 · Un clic y la campaña baja a toda la red. */
export function Publicar() {
  const clock = useClock();
  const { t } = clock;
  const click = seg(t, 1.1, 0.5);
  const wave = MOTION.draw(t, 1.7, 3.0);
  const okCount = Math.round(clamp((wave - 0.1) / 0.8, 0, 1) * 14);

  return (
    <Frame
      clock={clock}
      kicker="Un clic"
      line="Se publica en las 14 pantallas de las 4 sucursales. En minutos, no en días."
    >
      <div style={{ position: 'absolute', left: 150, top: 300, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div
          style={{
            ...MOTION.enter(t, 0.2, 0.5, 18),
            position: 'relative',
            width: 320,
            padding: '22px 30px',
            borderRadius: 16,
            background: click > 0.5 ? C.sky : 'rgba(14,165,233,0.16)',
            border: '1px solid rgba(14,165,233,0.5)',
            transform: `scale(${click > 0.2 && click < 0.8 ? 0.97 : 1})`,
          }}
        >
          <span
            style={{
              fontFamily: F.sans,
              fontSize: 26,
              fontWeight: 600,
              color: click > 0.5 ? '#04121a' : C.sky2,
            }}
          >
            Publicar campaña
          </span>
        </div>
        <Cursor x={250} y={40} click={click < 1 ? click : 0} />

        <div style={{ ...MOTION.enter(t, 2.2, 0.6, 16), display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontFamily: F.mono, fontSize: 68, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            {okCount}/14
          </span>
          <span style={{ fontFamily: F.sans, fontSize: 22, color: C.dim }}>
            pantallas actualizadas · 41 s promedio
          </span>
        </div>
      </div>

      <div style={{ position: 'absolute', right: 130, top: 250, width: 900, height: 340 }}>
        {DOTS.map((d, i) => {
          const on = wave > 0.12 + d.delay;
          const ring = clamp((wave - (0.12 + d.delay)) / 0.18, 0, 1);
          return (
            <div key={i} style={{ position: 'absolute', left: d.x, top: d.y }}>
              {ring > 0 && ring < 1 && (
                <span
                  style={{
                    position: 'absolute',
                    left: -14 - ring * 26,
                    top: -14 - ring * 26,
                    width: 28 + ring * 52,
                    height: 28 + ring * 52,
                    borderRadius: 999,
                    border: `2px solid rgba(14,165,233,${0.6 * (1 - ring)})`,
                  }}
                />
              )}
              <span
                style={{
                  display: 'block',
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  background: on ? 'rgba(52,211,153,0.22)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${on ? 'rgba(52,211,153,0.6)' : C.line2}`,
                  boxShadow: on ? '0 0 18px rgba(52,211,153,0.35)' : 'none',
                }}
              />
            </div>
          );
        })}
        <span
          style={{
            position: 'absolute',
            left: 120,
            top: 0,
            fontFamily: F.mono,
            fontSize: 13,
            letterSpacing: '0.2em',
            color: C.dim2,
          }}
        >
          RED DE PANTALLAS · 4 SUCURSALES
        </span>
      </div>
    </Frame>
  );
}

const COMPARATIVA: { concepto: string; garantia: string; color: string }[] = [
  { concepto: 'Display-Ads · Plan Flex', garantia: 'Recambio sin cargo, siempre', color: C.emerald },
  { concepto: 'Otros proveedores', garantia: 'Garantía limitada a 12 meses', color: C.dim2 },
];

/** 01:21 – 01:30 · Hardware de bajo costo y funcionamiento offline. */
export function Hardware() {
  const clock = useClock();
  const { t } = clock;
  const big = MOTION.pop(t, 1.4, 0.7);

  return (
    <Frame
      clock={clock}
      kicker="El hardware no es el problema"
      line="Corre en un Core Pro o en un Mostrador. Y si se corta internet, sigue reproduciendo."
    >
      <div style={{ position: 'absolute', left: 150, top: 220, ...MOTION.enter(t, 0.2, 0.6, 20) }}>
        <TV w={720} h={405}>
          <Creative kind="almuerzo" scale={0.8} />
        </TV>
        <div style={{ position: 'absolute', right: -190, bottom: -150, ...MOTION.enter(t, 0.9, 0.6, 16) }}>
          <PhotoSlot
            w={300}
            h={200}
            label="Display-Ads Core Pro"
            src="/assets/core-device.webp"
            radius={16}
            fit="contain"
          />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 140,
          top: 230,
          width: 700,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        <div style={{ transform: `scale(${big})`, transformOrigin: 'left top', opacity: MOTION.draw(t, 1.4, 0.5) }}>
          <div style={{ fontFamily: F.mono, fontSize: 24, letterSpacing: '0.2em', color: C.sky2, marginBottom: 10 }}>
            PLAN FLEX
          </div>
          <div
            style={{
              fontFamily: F.sans,
              fontSize: 112,
              fontWeight: 700,
              letterSpacing: '-0.05em',
              color: C.text,
              lineHeight: 0.9,
            }}
          >
            Garantía
            <br />
            <span style={{ color: C.sky2 }}>vitalicia</span>
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 26, color: C.dim, marginTop: 8 }}>
            Recambio del equipo sin cargo por desgaste, durante toda la vigencia del contrato.
          </div>
        </div>

        {COMPARATIVA.map((c, i) => (
          <div
            key={c.concepto}
            style={{
              ...MOTION.enter(t, 2.4 + i * 0.35, 0.5, 16),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              borderRadius: 14,
              background: 'rgba(24,24,27,0.7)',
              border: `1px solid ${C.line}`,
            }}
          >
            <span style={{ fontFamily: F.sans, fontSize: 21, color: C.text }}>{c.concepto}</span>
            <span style={{ fontFamily: F.mono, fontSize: 20, color: c.color }}>{c.garantia}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
