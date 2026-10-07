# Conectá tu Mostrador — guion de locución (72 s)

Tono: alguien parado frente al equipo, con las manos ocupadas. Concreto,
directo, sin jerga técnica. Fuente de todo dato: la guía de configuración
de mostradores en el local del cliente. Los tiempos coinciden con
`timeline.json` de este video.

Audiencia: `cliente` (el dueño del local o su empleado, no un técnico).

**Nomenclatura de producto (obligatoria):** el equipo se llama **Mostrador**
en el panel de la organización, y es un **Display-Ads Counter 15** (se
menciona una sola vez, como dice la caja). Jamás se nombra el hardware
interno por su nombre técnico, ni en pantalla ni en locución.

---

**00:00 – 00:07 · Apertura**
Llegó tu Mostrador nuevo. Antes de arrancar, tené a mano el equipo
y el cargador oficial. Nada más: la base ya viene integrada.

**00:07 – 00:15 · Paso 1 · Ubicalo en el mostrador**
Apoyá el Mostrador sobre el mostrador, de frente al público del local.
No hay que armar ni montar ningún soporte: la base es parte del equipo.

**00:15 – 00:24 · Paso 2 · Encendelo**
Conectá el cargador oficial y dejalo siempre enchufado. Al encenderlo
arranca directo en modo Kiosco: vas directo a tu campaña, nunca a otra
pantalla. No hay que instalar ni configurar nada en el local.

**00:24 – 00:33 · Si el Wi-Fi del local cambia**
La pantalla sigue mostrando tu contenido y reintenta sola, sin que nadie
toque nada — durante el primer minuto y medio.

**00:33 – 00:46 · Aparece la pantalla de recuperación**
Si la red no vuelve, la propia pantalla te muestra las redes Wi-Fi
cercanas. Tocá la del local en la lista, o escribila a mano si no aparece.
Esta pantalla sólo sirve para reconectar el Wi-Fi: no permite salir de la
aplicación ni acceder al resto del equipo, el modo Kiosco sigue activo en
todo momento.

**00:46 – 00:55 · Escribí la contraseña**
Escribí la contraseña de tu red y confirmá.

**00:55 – 01:03 · Listo, se reconecta solo**
La pantalla vuelve a mostrar tu campaña sola. No hace falta ninguna otra
acción — ni técnico, ni cable.

**01:03 – 01:12 · Verificá que quedó andando**
Tres señales te confirman que todo está bien: la pantalla mostrando tu
contenido o el logo de Display-Ads, que no aparezca la pantalla de
recuperación de Wi-Fi, y el estado ONLINE en el panel — donde tu equipo
figura como "Mostrador".

---

## Notas de producción

- **Flujo distinto al del Core Pro, a propósito:** este video no tiene
  conexión de cables de video ni red por cable — es una pantalla All-in-One
  con el reproductor integrado. Lo específico de este equipo es la
  ubicación del equipo, el modo Kiosco y sobre todo la **reconexión de
  Wi-Fi desde la propia pantalla de recuperación**, que no existe en el
  video del Core Pro. Por eso son dos videos separados y sin escenas
  compartidas (arquitectura de la Épica B).
- **Foto real del producto:** la escena "Apertura" muestra la foto del
  Display-Ads Counter 15 (`public/assets/counter-15.webp`, provista por el
  dueño). El resto del hardware (el equipo en las demás escenas y la toma de
  corriente) son diagramas vectoriales deterministas, no fotografía — igual
  criterio que el video del Core Pro.
- **El equipo NO lleva soporte:** es una tablet vertical con la base
  integrada al gabinete. El diagrama y el guion decían "montalo en su
  soporte", que mandaba a hacer un paso inexistente; corregido el 2026-07-29
  con la foto real del producto (FIX-098). La guía
  `docs/devices/android-client-setup-guide.md` arrastraba el mismo error y se
  corrigió en el mismo pase.
- **Nunca se muestra una contraseña de ejemplo.** El campo de contraseña de
  la pantalla de recuperación se representa siempre enmascarado (puntos),
  nunca con un valor tipeado.
- **Fuera de alcance de este video:** todo dato que no exista textualmente
  en la guía de configuración de mostradores (aprovisionamiento inicial con
  PC, redes con portal cautivo, troubleshooting extendido) queda fuera — es
  contenido de soporte o de otro rol (técnico), no de este instructivo de
  72 segundos para el personal del local.
