# Conectá tu Core Pro — guion de locución (72 s)

Tono: alguien parado frente al equipo, con las manos ocupadas. Concreto,
directo, sin jerga técnica (nada de "SSH", "portal cautivo", "systemd").
Fuente de todo dato: la guía de configuración de pantallas en el local del
cliente. Los tiempos coinciden con `timeline.json` de este video.

Audiencia: `cliente` (el dueño del local o su empleado, no un técnico).

**Nomenclatura de producto (obligatoria):** el equipo se llama **Core Pro**
(Display-Ads Core Pro). En ningún momento se lo nombra por su hardware
interno — eso queda sólo en comentarios de código, nunca en pantalla ni en
locución. En el panel de la organización aparece listado como **"Pantalla"**,
que es como el cliente lo va a buscar.

---

**00:00 – 00:07 · Apertura**
Llegó tu Core Pro nuevo. Antes de arrancar, tené a mano el equipo,
el cable de video y la fuente de alimentación.

**00:07 – 00:16 · Paso 1 · Conectá la pantalla**
Conectá el cable de video al primer puerto HDMI — el más cercano al USB-C —
y el otro extremo a la pantalla o TV.

**00:16 – 00:24 · Paso 2 · Red por cable**
Si tenés un punto de red cerca, conectá un cable de red desde el módem
o router: es la opción recomendada.

**00:24 – 00:33 · Paso 3 · Encendé el equipo**
Enchufá la fuente oficial al tomacorriente y conectala al equipo.
El LED del equipo se enciende en rojo.
Esperá unos 30 a 45 segundos mientras arranca.

**00:33 – 00:43 · Paso 4 · Conectate a la red del equipo**
Si no usaste cable, el equipo crea su propia red para configurarlo.
Buscala desde tu celular o tu compu: se llama DisplayAds-Setup, seguida
de un código propio de tu equipo. La contraseña es de cada equipo —
no hay una clave general — pedísela al soporte de Display-Ads: la
consulta en el panel y te la dicta.

**00:43 – 00:55 · Paso 5 · Elegí tu red Wi-Fi**
Abrí el navegador y entrá a http://10.42.0.1. Vas a ver la lista de redes
Wi-Fi cercanas: elegí la del local, o escribila a mano si no aparece.
Escribí la contraseña de tu red y tocá "Conectar Dispositivo".

**00:55 – 01:03 · Listo, se conecta solo**
La red de configuración desaparece sola, y el equipo arranca a mostrar
tu campaña en pocos segundos. No hace falta ninguna otra acción.

**01:03 – 01:12 · Verificá que quedó andando**
Tres señales te confirman que todo está bien: el LED de red parpadeando
en verde y naranja, la pantalla mostrando tu contenido o el logo de
Display-Ads, y el estado ONLINE en el panel — donde tu Core Pro figura
como "Pantalla".

---

## Notas de producción

- **Material real incorporado:** la escena "Apertura" usa la foto real del
  equipo (`public/assets/core-device.webp`, provista por el dueño): una caja
  blanca y roja con el logo de Display-Ads en la tapa. Reemplaza el
  `PhotoSlot` que estaba pendiente en la versión anterior de este video.
- **Diagrama de puertos fiel al gabinete real:** el diagrama vectorial de
  `components/hardware.tsx` representa la silueta de la caja (tapa blanca +
  bisel frontal rojo) y no una placa a la vista, con los puertos en el mismo
  orden y lado que muestra la foto: USB-C de alimentación, luego los dos
  HDMI de un lado; Ethernet RJ45 y los 4 USB del otro. Sigue siendo
  ilustración vectorial determinista, no fotografía — a propósito, ver
  `SKILLS/VIDEO-CREATOR.md` §"Ilustraciones del hardware".
- **Nunca se muestra una contraseña de ejemplo.** Ni en el hotspot
  (`DisplayAds-Setup-XXXX`, literal de la guía) ni en el panel de
  configuración: los campos de contraseña se representan siempre
  enmascarados (puntos), nunca con un valor tipeado.
- **Fuera de alcance de este video:** todo lo referido al Mostrador
  (DEC-OWNER-33-08, video "conexion-mostrador") y todo dato que no exista
  textualmente en la guía de configuración de pantallas (portales cautivos,
  troubleshooting extendido) queda fuera — es contenido de soporte, no de
  este instructivo de 72 segundos.
