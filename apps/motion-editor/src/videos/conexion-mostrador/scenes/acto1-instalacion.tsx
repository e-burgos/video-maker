import { C, F } from '../../../theme';
import { MOTION, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { PhotoSlot, Glyph, StepNumber, NoteCard } from '../../../components/bits';
import {
  CounterKiosk,
  Cable,
  WallOutlet,
  WALL_CABLE_ANCHOR,
  counterKioskSize,
  counterCableAnchor,
} from '../components/kiosk';

/* ACTO 1 — instalación física: dónde apoyarlo y encendido en modo Kiosco. */

// La base viene integrada al equipo: NO hay soporte que montar ni que pedirle
// al cliente (corrección del dueño, 2026-07-29, con la foto real del producto).
const NECESARIO = ['Tu Mostrador', 'Cargador oficial'];

/** 00:00 – 00:07 · Qué vas a necesitar antes de empezar. */
export function Apertura() {
  const clock = useClock();
  const { t } = clock;

  return (
    <Frame clock={clock} kicker="Antes de arrancar" line="Vas a necesitar el equipo y su cargador. Nada más.">
      <PhotoSlot
        w={560}
        h={480}
        label="Display-Ads Counter 15"
        src="/assets/counter-15.webp"
        fit="contain"
        style={{ position: 'absolute', left: 190, top: 280, ...MOTION.enter(t, 0.3) }}
      />
      <div style={{ position: 'absolute', left: 900, top: 400, display: 'flex', flexDirection: 'column', gap: 30 }}>
        {NECESARIO.map((it, i) => (
          <div
            key={it}
            style={{ ...MOTION.enter(t, 0.8 + i * 0.5, 0.5), display: 'flex', alignItems: 'center', gap: 20 }}
          >
            <Glyph kind="check" color={C.emerald} size={30} />
            <span style={{ fontFamily: F.sans, fontSize: 40, fontWeight: 600, color: C.text }}>{it}</span>
          </div>
        ))}
        <NoteCard
          tone="sky"
          icon="check"
          title="La base ya viene puesta"
          text="El equipo trae su base integrada: no hay que armar ni montar nada. Lo sacás de la caja y lo apoyás."
          w={620}
          style={{ ...MOTION.enter(t, 2.2, 0.55, 18), marginTop: 14 }}
        />
      </div>
    </Frame>
  );
}

/** 00:07 – 00:15 · Dónde apoyarlo: no hay nada que montar. */
export function Ubicacion() {
  const clock = useClock();
  const { t } = clock;
  const pop = MOTION.enter(t, 0.2, 0.55);
  const size = counterKioskSize(300, 520);

  return (
    <Frame
      clock={clock}
      kicker="Paso 1 · Ubicá tu Mostrador"
      line="Apoyalo en el mostrador, de frente al público. No hay que montar ningún soporte."
    >
      <StepNumber n={1} style={{ position: 'absolute', left: 150, top: 150 }} />
      <CounterKiosk
        w={300}
        h={520}
        fallback
        style={{ position: 'absolute', left: 960 - size.w / 2, top: 210, ...pop }}
      />
    </Frame>
  );
}

/** 00:15 – 00:24 · Alimentación oficial y encendido en modo Kiosco. */
export function EncendidoKiosco() {
  const clock = useClock();
  const { t } = clock;
  const kioskPop = MOTION.enter(t, 0.2, 0.55);
  const outletPop = MOTION.enter(t, 0.5, 0.5);
  const cable = MOTION.draw(t, 0.9, 1);
  const notePop = MOTION.enter(t, 2.6, 0.55, 18);

  const screenW = 280;
  const screenH = 470;
  const kioskX = 800;
  const kioskY = 210;
  const anchor = counterCableAnchor(screenW, screenH);
  const outletX = 1500;
  const outletY = 520;

  return (
    <Frame
      clock={clock}
      kicker="Paso 2 · Encendela"
      line="Conectá el cargador oficial y dejala siempre enchufada."
    >
      <StepNumber n={2} style={{ position: 'absolute', left: 150, top: 150 }} />
      <CounterKiosk
        w={screenW}
        h={screenH}
        fallback
        style={{ position: 'absolute', left: kioskX, top: kioskY, ...kioskPop }}
      />
      <Cable
        x1={kioskX + anchor.x}
        y1={kioskY + anchor.y}
        x2={outletX + WALL_CABLE_ANCHOR.x}
        y2={outletY + WALL_CABLE_ANCHOR.y}
        progress={cable}
        color={C.dim}
        drop={150}
      />
      <WallOutlet x={outletX} y={outletY} plugged={MOTION.pop(t, 0.6, 0.5)} style={outletPop} />
      <NoteCard
        tone="sky"
        icon="check"
        title="Arranca directo en modo Kiosco"
        text="Al encenderla vas directo a tu campaña — nunca a otra pantalla. No hay que instalar ni configurar nada en el local."
        w={540}
        style={{ position: 'absolute', left: 150, top: 600, ...notePop }}
      />
    </Frame>
  );
}
