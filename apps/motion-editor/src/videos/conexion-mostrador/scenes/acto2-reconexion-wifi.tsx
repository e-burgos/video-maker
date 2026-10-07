import { C, F } from '../../../theme';
import { MOTION, useClock } from '../../../motion';
import { Frame } from '../../../components/Frame';
import { NoteCard, StepNumber } from '../../../components/bits';
import { CounterKiosk, RecoveryPanel, RetryBadge } from '../components/kiosk';

/* ACTO 2 — reconexión de Wi-Fi: lo que hace único a este video frente al del
 * Core Pro (guía §2: la propia pantalla resuelve la reconexión, sin técnico
 * ni cable, desde su pantalla de recuperación). */

const REDES_LOCAL = ['WiFi-Local-Cafeteria', 'Vecino_5G'];

/** 00:24 – 00:33 · Si el Wi-Fi del local cambia, sigue andando y reintenta sola. */
export function Reintentando() {
  const clock = useClock();
  const { t } = clock;
  const kioskPop = MOTION.enter(t, 0.2, 0.55);
  const badgeIn = MOTION.enter(t, 3.6, 0.5, 16);

  return (
    <Frame
      clock={clock}
      kicker="Si el Wi-Fi del local cambia"
      line="La pantalla sigue mostrando tu contenido y reintenta sola, sin tocar nada."
    >
      <CounterKiosk w={300} h={520} fallback style={{ position: 'absolute', left: 620, top: 190, ...kioskPop }} />
      <RetryBadge t={t} style={{ position: 'absolute', left: 1120, top: 470, ...badgeIn }} />
    </Frame>
  );
}

/** 00:33 – 00:46 · Si no vuelve, aparece la pantalla de recuperación con las redes cercanas. */
export function PantallaRecuperacion() {
  const clock = useClock();
  const { t } = clock;
  const kioskPop = MOTION.enter(t, 0.3, 0.55);
  const notePop = MOTION.enter(t, 4.2, 0.55, 18);
  const selected = t >= 5 ? REDES_LOCAL[0] : null;

  return (
    <Frame
      clock={clock}
      kicker="Aparece la pantalla de recuperación"
      line="Tocá la red del local en la lista, o escribila a mano si no aparece."
    >
      <StepNumber n={1} style={{ position: 'absolute', left: 150, top: 150 }} />
      <CounterKiosk
        w={340}
        h={560}
        style={{ position: 'absolute', left: 1180, top: 170, ...kioskPop }}
      >
        <RecoveryPanel networks={REDES_LOCAL} selected={selected} passwordFilled={false} confirmed={false} />
      </CounterKiosk>
      {/* ISSUE-73-01 / HU-73-B-02 CA-5 / RF-73-B-02 RN-2: la pantalla de recuperación
       * SOLO sirve para reconectar el Wi-Fi, nunca para salir del modo Kiosco
       * (android-client-setup-guide.md:48-50, callout "Seguridad:"). */}
      <NoteCard
        tone="sky"
        icon="check"
        title="Sólo sirve para el Wi-Fi"
        text="Esta pantalla no permite salir de la aplicación ni acceder al resto del equipo: el modo Kiosco sigue activo en todo momento."
        w={620}
        style={{ position: 'absolute', left: 150, top: 720, ...notePop }}
      />
    </Frame>
  );
}

/** 00:46 – 00:55 · Escribir la contraseña y confirmar. */
export function Reconexion() {
  const clock = useClock();
  const { t } = clock;
  const kioskPop = MOTION.enter(t, 0.2, 0.5);
  const passwordFilled = t >= 3;
  const confirmed = t >= 6;

  return (
    <Frame
      clock={clock}
      kicker="Paso 2 · Escribí la contraseña"
      line="Escribí la contraseña de tu red y confirmá."
    >
      <StepNumber n={2} style={{ position: 'absolute', left: 150, top: 150 }} />
      <CounterKiosk
        w={340}
        h={560}
        style={{ position: 'absolute', left: 1180, top: 170, ...kioskPop }}
      >
        <RecoveryPanel networks={REDES_LOCAL} selected={REDES_LOCAL[0]} passwordFilled={passwordFilled} confirmed={confirmed} />
      </CounterKiosk>
    </Frame>
  );
}

/** 00:55 – 01:03 · Vuelve sola a mostrar la campaña, sin ninguna otra acción. */
export function Reconectado() {
  const clock = useClock();
  const { t } = clock;
  const kioskPop = MOTION.enter(t, 0.2, 0.55);
  const notePop = MOTION.enter(t, 2.4, 0.55, 16);

  return (
    <Frame clock={clock} kicker="Listo, se reconecta solo" line="La pantalla vuelve a mostrar tu campaña sin ayuda.">
      <CounterKiosk w={340} h={560} style={{ position: 'absolute', left: 1180, top: 170, ...kioskPop }}>
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
          <span style={{ fontFamily: F.sans, fontSize: 32, fontWeight: 700, color: C.text }}>
            Tu campaña ya está en pantalla
          </span>
        </div>
      </CounterKiosk>
      <NoteCard
        tone="emerald"
        icon="check"
        title="No hace falta nada más"
        text="Ni técnico ni cable: la reconexión la resuelve el personal del local desde la propia pantalla."
        w={620}
        style={{ position: 'absolute', left: 150, top: 460, ...notePop }}
      />
    </Frame>
  );
}
