import { C, F } from '../../../theme';
import { MOTION, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { Glyph } from '../../../components/bits';
import { LedDot, DeviceScreen } from '../components/hardware';

/* ACTO 3 — verificación: los mismos tres indicadores de la guía, en el mismo orden. */

/** 01:03 – 01:12 · Los tres indicadores de que el equipo quedó andando. */
export function Verificacion() {
  const clock = useClock();
  const { t } = clock;
  const row1 = MOTION.enter(t, 0.3, 0.5);
  const row2 = MOTION.enter(t, 1.1, 0.5);
  const row3 = MOTION.enter(t, 1.9, 0.5);
  const screenIn = MOTION.enter(t, 2.7, 0.55);

  return (
    <Frame clock={clock} kicker="Verificá que quedó andando" line="Tres señales te confirman que la pantalla está lista.">
      <div style={{ position: 'absolute', left: 150, top: 340, display: 'flex', flexDirection: 'column', gap: 34 }}>
        <div style={{ ...row1, display: 'flex', alignItems: 'center', gap: 20 }}>
          <LedDot color={C.emerald} t={t} blink size={16} />
          <LedDot color={C.amber} t={t + 0.3} blink size={16} />
          <span style={{ fontFamily: F.sans, fontSize: 32, fontWeight: 600, color: C.text }}>
            LED de red parpadeando en verde y naranja
          </span>
        </div>
        <div style={{ ...row2, display: 'flex', alignItems: 'center', gap: 20 }}>
          <Glyph kind="check" color={C.sky2} size={28} />
          <span style={{ fontFamily: F.sans, fontSize: 32, fontWeight: 600, color: C.text }}>
            La pantalla muestra tu contenido o el logo de respaldo
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
            <LedDot color={C.emerald} t={t} size={10} />
            <span style={{ fontFamily: F.mono, fontSize: 20, color: C.emerald, letterSpacing: '0.08em' }}>
              ONLINE
            </span>
          </span>
          <span style={{ fontFamily: F.sans, fontSize: 32, fontWeight: 600, color: C.text }}>
            en el panel de control
          </span>
        </div>
      </div>

      <DeviceScreen w={520} h={300} fallback style={{ position: 'absolute', left: 1280, top: 380, ...screenIn }} />
    </Frame>
  );
}
