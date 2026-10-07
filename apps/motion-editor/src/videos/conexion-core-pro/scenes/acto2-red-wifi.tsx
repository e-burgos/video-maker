import { C, F } from '../../../theme';
import { MOTION, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { NoteCard, StepNumber } from '../../../components/bits';
import { WifiHotspotCard, BrowserConfigMock, DeviceScreen } from '../components/hardware';

/* ACTO 2 — red de configuración: hotspot, panel web y transición automática. */

const SSID = 'DisplayAds-Setup-XXXX';
const REDES_LOCAL = ['WiFi-Local-Cafeteria', 'Vecino_5G'];

/** 00:33 – 00:43 · El equipo crea su propia red de configuración. */
export function RedConfiguracion() {
  const clock = useClock();
  const { t } = clock;
  const cardPop = MOTION.enter(t, 0.4, 0.55);
  const notePop = MOTION.enter(t, 3.2, 0.55, 18);

  return (
    <Frame
      clock={clock}
      kicker="Paso 4 · Conectate a la red del equipo"
      line="El equipo crea su propia red para configurarlo: buscala desde tu celular o compu."
    >
      <StepNumber n={4} style={{ position: 'absolute', left: 150, top: 150 }} />
      <WifiHotspotCard ssid={SSID} style={{ position: 'absolute', left: 220, top: 380, ...cardPop }} />
      <NoteCard
        tone="amber"
        icon="alert"
        title="La contraseña es de tu equipo"
        text="Cada equipo trae la suya. Pedísela al soporte de Display-Ads: la consulta en el panel y te la dicta."
        w={620}
        style={{ position: 'absolute', left: 220, top: 620, ...notePop }}
      />
    </Frame>
  );
}

/** 00:43 – 00:55 · Panel web: elegir la red del local y conectar. */
export function PantallaConfig() {
  const clock = useClock();
  const { t } = clock;
  const browserPop = MOTION.enter(t, 0.3, 0.55);
  const selected = t >= 4 ? REDES_LOCAL[0] : null;
  const passwordFilled = t >= 7.5;
  const buttonPressed = t >= 10;

  return (
    <Frame
      clock={clock}
      kicker="Paso 5 · Elegí tu red Wi-Fi"
      line="Entrá a 10.42.0.1, elegí la red del local y escribí su contraseña."
    >
      <StepNumber n={5} style={{ position: 'absolute', left: 150, top: 150 }} />
      <BrowserConfigMock
        networks={REDES_LOCAL}
        selected={selected}
        passwordFilled={passwordFilled}
        buttonPressed={buttonPressed}
        style={{ position: 'absolute', left: 620, top: 260, ...browserPop }}
      />
    </Frame>
  );
}

/** 00:55 – 01:03 · Transición automática: el hotspot desaparece y arranca solo. */
export function Transicion() {
  const clock = useClock();
  const { t } = clock;
  const fadeOut = Math.max(0, 1 - t / 2.4);
  const cardIn = MOTION.enter(t, 0, 0.4);
  const screenIn = MOTION.enter(t, 3.4, 0.6);

  return (
    <Frame
      clock={clock}
      kicker="Listo, se conecta solo"
      line="La red de configuración desaparece y el equipo arranca a mostrar tu campaña."
    >
      <WifiHotspotCard
        ssid={SSID}
        style={{
          position: 'absolute',
          left: 220,
          top: 380,
          opacity: cardIn.opacity * fadeOut,
          transform: cardIn.transform,
        }}
      />
      <DeviceScreen
        w={640}
        h={360}
        style={{ position: 'absolute', left: 1050, top: 340, ...screenIn }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            background: 'linear-gradient(140deg,#0e2f3a,#06171d)',
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: '0.2em', color: C.emerald }}>
            EN VIVO
          </span>
          <span style={{ fontFamily: F.sans, fontSize: 34, fontWeight: 700, color: C.text }}>
            Tu campaña ya está en pantalla
          </span>
        </div>
      </DeviceScreen>
    </Frame>
  );
}
