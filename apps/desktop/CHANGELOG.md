# Changelog — Video Maker

Historial de versiones de la app de escritorio, en español, pensado para los amigos que la
instalan. `apps/desktop/scripts/release-desktop.mjs` toma la sección de la versión que publica
y la usa como notas del release.

## 0.1.0 — Primera versión para amigos

Primera versión que sale del disco del dev. Como es la primera, esto es todo lo que hace la app
hoy:

- Un estudio de video que corre entero en tu Mac: subís tu material (grabaciones de pantalla,
  cámara, fotos, música) y un productor de IA propone guion, corte, subtítulos, locución y
  música, y vos confirmás o ajustás cada paso.
- El render final (mezcla de video, audio, subtítulos y logo) se hace en tu máquina con ffmpeg y
  Remotion — no sale nada de tu material a ningún servidor.
- Tres recetas listas para empezar: Tutorial (pantalla grabada + voz sincronizada), Tutorial
  vertical (la misma receta en 9:16 para Reels/TikTok/Shorts) y Publicidad (spot corto a partir
  de fotos).
- Voces en español generadas localmente (es_AR, es_ES, es_MX) para narrar sin grabar tu propia
  voz, además de la opción de usar una locución tuya.
- Conversación con el productor por Claude Code (con tu propia suscripción) o por una API key de
  OpenRouter — vos elegís el motor y el modelo desde Configuración.
- Primer arranque con las descargas de los modelos necesarios (voces, transcripción, navegador
  para el render) verificadas por tamaño y sha256, reanudables si se cortan.
- App sin firmar (sin cuenta de Apple Developer): la primera apertura pide un paso extra en
  Ajustes de Privacidad y seguridad — documentado en la web de instalación.
