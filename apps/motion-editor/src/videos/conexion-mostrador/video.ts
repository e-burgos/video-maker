// Video "Conectá tu Mostrador" — instructivo para el cliente final que
// recibe un Display-Ads Counter 15 (por dentro, una tablet Android en modo
// Kiosk/Device Owner — nunca se lo llama así en pantalla, ver
// docs/product/webapp-user-manual.md líneas 11/71/209-210) en su local
// (Ciclo 73, Épica B, TASK-FE-73-14/15). Fiel a
// docs/devices/android-client-setup-guide.md: todo paso, tiempo y
// comportamiento que aparece acá existe textualmente en esa guía. El flujo
// es distinto al del Core Pro (instalación All-in-One + reconexión de
// Wi-Fi desde la pantalla de recuperación del propio kiosco), por eso es un
// video aparte y no reutiliza escenas/componentes de `conexion-core-pro`
// (regla de la Épica B). El slug no aparece acá: lo pone el registro a
// partir del nombre de esta carpeta (conexion-mostrador).
import { defineVideo } from '../define-video';
import timeline from './timeline.json';
import { Apertura, Ubicacion, EncendidoKiosco } from './scenes/acto1-instalacion';
import { Reintentando, PantallaRecuperacion, Reconexion, Reconectado } from './scenes/acto2-reconexion-wifi';
import { Verificacion } from './scenes/acto3-verificacion';

export default defineVideo({
  title: 'Conectá tu Mostrador',
  audience: 'cliente',
  scenes: {
    Apertura,
    Ubicacion,
    EncendidoKiosco,
    Reintentando,
    PantallaRecuperacion,
    Reconexion,
    Reconectado,
    Verificacion,
  },
  timeline,
});
