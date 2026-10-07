import { C, F } from '../../../theme';
import { MOTION, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { Glyph, StepNumber } from '../../../components/bits';
import {
  CoreProCase,
  Cable,
  PowerOutlet,
  POWER_CABLE_ANCHOR,
  Router,
  ROUTER_CABLE_ANCHOR,
  LedDot,
  DeviceScreen,
  screenCableAnchor,
  portAnchor,
} from '../components/hardware';

/* ACTO 1 — conexión física: video, red (opcional) y encendido. */

const CASE_X = 220;
const CASE_Y = 460;

const NECESARIO = ['Tu Core Pro', 'Cable de video (HDMI)', 'Fuente de poder USB-C'];

/** 00:00 – 00:07 · Qué vas a necesitar antes de empezar. */
export function Apertura() {
  const clock = useClock();
  const { t } = clock;

  return (
    <Frame clock={clock} kicker="Antes de arrancar" line="Vas a necesitar el equipo, el cable de video y la fuente.">
      {/* Foto real del equipo (provista por el dueño): caja blanca y roja con
          el logo de Display-Ads en la tapa. El exportador precachea este
          <img> como data: URL (FIX-096) — no reemplazar por una versión con
          fetch propio. */}
      <img
        src="/assets/core-device.webp"
        alt="Display-Ads Core Pro recién desempacado"
        style={{
          position: 'absolute',
          left: 150,
          top: 300,
          width: 620,
          height: 420,
          objectFit: 'contain',
          ...MOTION.enter(t, 0.3),
        }}
      />
      <div style={{ position: 'absolute', left: 900, top: 350, display: 'flex', flexDirection: 'column', gap: 30 }}>
        {NECESARIO.map((it, i) => (
          <div
            key={it}
            style={{ ...MOTION.enter(t, 0.8 + i * 0.5, 0.5), display: 'flex', alignItems: 'center', gap: 20 }}
          >
            <Glyph kind="check" color={C.emerald} size={30} />
            <span style={{ fontFamily: F.sans, fontSize: 40, fontWeight: 600, color: C.text }}>{it}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** 00:07 – 00:16 · Conectar el cable de video al puerto HDMI 0. */
export function ConexionVideo() {
  const clock = useClock();
  const { t } = clock;
  const cable = MOTION.draw(t, 1, 1.1);
  const ring = MOTION.pop(t, 1.6, 0.5);
  const screenPop = MOTION.enter(t, 0.2, 0.5);
  const anchor = portAnchor('hdmi0');
  const anchorX = CASE_X + anchor.x;
  const anchorY = CASE_Y + anchor.y;
  const screenX = 1240;
  const screenY = 250;
  const screenW = 560;
  const screenH = 320;
  const input = screenCableAnchor(screenW, screenH);

  return (
    <Frame
      clock={clock}
      kicker="Paso 1 · Conectá la pantalla"
      line="El cable de video va al primer puerto HDMI, el más cercano al USB-C."
    >
      <StepNumber n={1} style={{ position: 'absolute', left: 150, top: 150 }} />
      <CoreProCase
        x={CASE_X}
        y={CASE_Y}
        highlight="hdmi0"
        highlightNote="el más cercano al USB-C"
        highlightProgress={ring}
      />
      <Cable
        x1={anchorX}
        y1={anchorY}
        x2={screenX + input.x}
        y2={screenY + input.y}
        progress={cable}
        color={C.sky2}
        drop={150}
      />
      <DeviceScreen
        w={screenW}
        h={screenH}
        stand
        showInput
        style={{ position: 'absolute', left: screenX, top: screenY, ...screenPop }}
      />
    </Frame>
  );
}

/** 00:16 – 00:24 · Red por cable, la opción recomendada cuando hay punto cercano. */
export function ConexionRed() {
  const clock = useClock();
  const { t } = clock;
  const cable = MOTION.draw(t, 1, 1);
  const ring = MOTION.pop(t, 1.5, 0.5);
  const routerPop = MOTION.enter(t, 0.2, 0.5);
  const anchor = portAnchor('eth');
  const anchorX = CASE_X + anchor.x;
  const anchorY = CASE_Y + anchor.y;
  const routerX = 1330;
  const routerY = 430;

  return (
    <Frame
      clock={clock}
      kicker="Paso 2 · Red por cable (recomendada)"
      line="Si tenés un punto de red cerca, conectalo — es la opción recomendada."
    >
      <StepNumber n={2} style={{ position: 'absolute', left: 150, top: 150 }} />
      <CoreProCase
        x={CASE_X}
        y={CASE_Y}
        highlight="eth"
        highlightNote="el puerto de red, junto a los USB"
        highlightProgress={ring}
      />
      <Cable
        x1={anchorX}
        y1={anchorY}
        x2={routerX + ROUTER_CABLE_ANCHOR.x}
        y2={routerY + ROUTER_CABLE_ANCHOR.y}
        progress={cable}
        color={C.emerald}
        drop={170}
      />
      <Router x={routerX} y={routerY} style={routerPop} />
    </Frame>
  );
}

/** 00:24 – 00:33 · Enchufar la fuente: LED rojo y espera de arranque. */
export function Encendido() {
  const clock = useClock();
  const { t, len } = clock;
  const cable = MOTION.draw(t, 1.4, 1);
  const brickPop = MOTION.enter(t, 0.2, 0.5);
  // La ficha entra al tomacorriente antes de que se dibuje el cable.
  const plugged = MOTION.pop(t, 0.8, 0.5);
  const ledIn = MOTION.enter(t, 2.6, 0.4);
  const waitProgress = Math.min(1, Math.max(0, (t - 2.4) / Math.max(0.001, len - 2.6)));
  const anchor = portAnchor('usbc');
  const anchorX = CASE_X + anchor.x;
  const anchorY = CASE_Y + anchor.y;
  const outletX = 1320;
  const outletY = 700;

  return (
    <Frame
      clock={clock}
      kicker="Paso 3 · Encendé el equipo"
      line="Conectá la fuente oficial. El LED se enciende en rojo. Esperá unos 30 a 45 segundos."
    >
      <StepNumber n={3} style={{ position: 'absolute', left: 150, top: 150 }} />
      <CoreProCase x={CASE_X} y={CASE_Y} />
      <Cable
        x1={anchorX}
        y1={anchorY}
        x2={outletX + POWER_CABLE_ANCHOR.x}
        y2={outletY + POWER_CABLE_ANCHOR.y}
        progress={cable}
        color={C.dim}
        drop={150}
      />
      <PowerOutlet x={outletX} y={outletY} plugged={plugged} style={brickPop} />

      <div
        style={{
          position: 'absolute',
          left: CASE_X + 40,
          top: CASE_Y - 90,
          ...ledIn,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <LedDot color={C.red} t={t} size={20} />
        <span style={{ fontFamily: F.mono, fontSize: 22, color: C.text }}>LED encendido en rojo</span>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 180,
          top: 420,
          width: 460,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <span style={{ fontFamily: F.mono, fontSize: 20, color: C.dim, letterSpacing: '0.08em' }}>
          arranque · 30-45 s
        </span>
        <div style={{ height: 10, borderRadius: 999, background: C.line, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${waitProgress * 100}%`,
              background: `linear-gradient(90deg, ${C.sky}, ${C.teal})`,
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </Frame>
  );
}
