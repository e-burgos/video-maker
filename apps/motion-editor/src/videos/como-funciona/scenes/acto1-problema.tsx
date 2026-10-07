import { Easing } from '../../../engine/api';
import { C, F, W, H } from '../../../theme';
import { MOTION, lerp, seg, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { PhotoSlot } from '../../../components/bits';
import { TV, Creative } from '../components/screen';

/* ACTO 1 — el problema del comercio: la pantalla desactualizada. */

/** 00:00 – 00:08 · El local a la mañana, con la promo vencida en pantalla. */
export function Apertura() {
  const clock = useClock();
  const { t } = clock;
  const zoom = lerp(1, 1.06, seg(t, 0, 8, Easing.easeInOutSine)); // ken burns lento
  const badge = MOTION.enter(t, 3.4, 0.6);

  return (
    <Frame
      clock={clock}
      time="dom 27 jul · 08:10"
      kicker="El punto de partida"
      line="Tu pantalla sigue mostrando la promo del mes pasado."
    >
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: '58% 45%' }}>
        <PhotoSlot
          w={W}
          h={H}
          label="foto · interior de la cafetería (reemplazar)"
          radius={0}
          labelTop
          pad="170px 0 0 150px"
          style={{ position: 'absolute', inset: 0, opacity: 0.55 }}
        />
        <TV w={880} h={495} style={{ position: 'absolute', left: 720, top: 250 }} live={false}>
          <Creative kind="vencida" scale={0.97} />
        </TV>
        <div
          style={{
            position: 'absolute',
            left: 1300,
            top: 800,
            ...badge,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderRadius: 14,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 18, color: '#fca5a5', letterSpacing: '0.06em' }}>
            vencida hace 27 días
          </span>
        </div>
      </div>
    </Frame>
  );
}

const RITUAL = ['Ir hasta el local', 'Conectar un pendrive', 'Volver a hacerlo mañana'];

interface Costo {
  cifra: string;
  detalle: string;
}

const COSTOS: Costo[] = [
  { cifra: '14 días', detalle: 'de contenido desactualizado, en promedio' },
  { cifra: '0', detalle: 'visibilidad de qué se está reproduciendo' },
  { cifra: '3 h', detalle: 'por viaje a cada sucursal' },
];

/** 00:08 – 00:17 · El ritual manual, tachado uno por uno. */
export function Problema() {
  const clock = useClock();
  const { t } = clock;

  return (
    <Frame
      clock={clock}
      kicker="El costo de hacerlo a mano"
      line="Y aun así, nadie sabe si la pantalla está prendida."
    >
      <div style={{ position: 'absolute', left: 150, top: 236, display: 'flex', flexDirection: 'column', gap: 26 }}>
        {RITUAL.map((it, i) => {
          const st = MOTION.enter(t, 0.5 + i * 0.55, 0.5);
          const strike = MOTION.draw(t, 3.1 + i * 0.4, 0.5);
          return (
            <div key={it} style={{ ...st, position: 'relative', display: 'flex', alignItems: 'center', gap: 22 }}>
              <span style={{ fontFamily: F.mono, fontSize: 22, color: C.dim2, width: 44 }}>
                {`0${i + 1}`}
              </span>
              <span
                style={{
                  fontFamily: F.sans,
                  fontSize: 72,
                  fontWeight: 600,
                  letterSpacing: '-0.035em',
                  color: strike > 0.4 ? C.dim2 : C.text,
                }}
              >
                {it}
              </span>
              <span
                style={{
                  position: 'absolute',
                  left: 60,
                  top: '52%',
                  height: 4,
                  borderRadius: 4,
                  width: `${strike * 100}%`,
                  maxWidth: 660,
                  background: C.sky,
                  boxShadow: `0 0 18px ${C.sky}`,
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 250,
          width: 420,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {COSTOS.map((c, i) => (
          <div
            key={c.detalle}
            style={{
              ...MOTION.enter(t, 1.6 + i * 0.45, 0.55, 18),
              padding: '20px 22px',
              borderRadius: 16,
              background: 'rgba(24,24,27,0.7)',
              border: `1px solid ${C.line}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span style={{ fontFamily: F.mono, fontSize: 26, fontWeight: 700, color: C.red }}>{c.cifra}</span>
            <span style={{ fontFamily: F.sans, fontSize: 18, color: C.dim }}>{c.detalle}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
