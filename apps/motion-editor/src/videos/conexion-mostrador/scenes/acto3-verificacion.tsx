import { C, F } from '../../../theme';
import { MOTION, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { Glyph } from '../../../components/bits';
import { CounterKiosk } from '../components/kiosk';

/* ACTO 3 — verificación: los mismos tres indicadores de la guía, en el mismo orden. */

/** 01:03 – 01:12 · Los tres indicadores de que el equipo quedó andando. */
export function Verificacion() {
  const clock = useClock();
  const { t } = clock;
  const row1 = MOTION.enter(t, 0.3, 0.5);
  const row2 = MOTION.enter(t, 1.1, 0.5);
  const row3 = MOTION.enter(t, 1.9, 0.5);
  const kioskIn = MOTION.enter(t, 2.7, 0.55);

  return (
    <Frame clock={clock} kicker="Verificá que quedó andando" line="Tres señales te confirman que el Mostrador está listo.">
      <div style={{ position: 'absolute', left: 150, top: 340, display: 'flex', flexDirection: 'column', gap: 34 }}>
        <div style={{ ...row1, display: 'flex', alignItems: 'center', gap: 20 }}>
          <Glyph kind="check" color={C.sky2} size={28} />
          <span style={{ fontFamily: F.sans, fontSize: 32, fontWeight: 600, color: C.text }}>
            La pantalla muestra tu contenido o el logo de respaldo
          </span>
        </div>
        <div style={{ ...row2, display: 'flex', alignItems: 'center', gap: 20 }}>
          <Glyph kind="check" color={C.sky2} size={28} />
          <span style={{ fontFamily: F.sans, fontSize: 32, fontWeight: 600, color: C.text }}>
            No aparece la pantalla de recuperación de Wi-Fi
          </span>
        </div>
        <div style={{ ...row3, display: 'flex', alignItems: 'center', gap: 20 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 999,
              background: 'rgba(52,211,153,0.14)',
              border: `1px solid ${C.emerald}`,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: C.emerald,
                boxShadow: `0 0 10px ${C.emerald}`,
                display: 'inline-block',
              }}
            />
            <span style={{ fontFamily: F.mono, fontSize: 20, color: C.emerald, letterSpacing: '0.08em' }}>
              ONLINE
            </span>
          </span>
          <span style={{ fontFamily: F.sans, fontSize: 32, fontWeight: 600, color: C.text }}>
            en el panel de control, como "Mostrador"
          </span>
        </div>
      </div>

      <CounterKiosk w={260} h={440} fallback style={{ position: 'absolute', left: 1400, top: 290, ...kioskIn }} />
    </Frame>
  );
}
