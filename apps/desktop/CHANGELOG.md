# Changelog — Video Maker

Historial de versiones de la app de escritorio, en español, pensado para los amigos que la
instalan. `apps/desktop/scripts/release-desktop.mjs` toma la sección de la versión que publica
y la usa como notas del release.

## 0.4.0 — Tus marcas, publicar en YouTube y un productor con más criterio

- Nueva página **Marcas**: creá una marca de cero o duplicando una existente, con nombre, logo, colores, tipografías,
  voz, música, fotos y productos, y elegila al crear cada video. Los videos de motion graphics y los de material
  crudo usan su logo, sus colores y su voz.
- **Publicar en YouTube** desde el estudio: conectás tu canal y publicás cada video con título, descripción y
  créditos de música.
- **Revisión automática** de cada video: volumen de la voz y de la música por tramo, cuadros negros o congelados,
  silencios largos y duración contra lo prometido. Si encuentra algo grave, no te deja publicar sin avisarte.
- **Propuesta antes de producir**: el productor te ofrece dos o tres enfoques con su duración y el tiempo estimado,
  vos elegís uno y ves una muestra corta antes del video completo.
- El productor **mira tu material** antes de proponer y te avisa si alguna foto o captura no sirve para la idea o si
  falta algo; después del render revisa el video escena por escena y te dice qué corregir.
- Escenas que explican una **interfaz** con cursor, clics y resaltados sobrios; la cámara sigue cada paso para que
  el texto se lea.
- **Dirección de voz** por frase (ritmo, energía y pausas) y música por tramos que baja mientras se habla.
- **Video de referencia**: subí un video que te guste y el estudio analiza sus escenas, su ritmo y su voz para que el
  productor proponga algo parecido.
- Si escribís mientras el productor trabaja, tu mensaje queda en espera y se envía solo cuando termina.

## 0.3.3 — Videos de motion graphics completos en el estudio

- Una sola barra en todas las pantallas del video: productor, motion, biblioteca, storyboard, voz y vista previa.
  Ya no perdés el acceso al chat del productor al entrar a una sección.
- En los videos de motion graphics, storyboard, voz y vista previa muestran lo que se generó: las escenas con
  sus textos y fotos, la voz de cada escena para escucharla y el video con botones para saltar a cada escena.
- Las sugerencias del productor ahora son botones que cargan el texto en la caja: lo podés editar antes de enviar.
- El productor usa bien tus fotos nuevas en las escenas, sin rehacer el storyboard entero ni cambiar el volumen
  de la música.

## 0.3.2 — Ajustá tus videos de motion graphics conversando

- Botón "Ajustar con el productor" en cada video de motion graphics: le pedís cambios en tus palabras
  ("bajá la música", "cambiá el título de la escena 3") y el productor edita las escenas, te muestra el
  cambio y rehace el video.
- Rehacer un video ajustado es mucho más rápido: sólo se vuelve a grabar la voz de las escenas que cambiaste.
- La música suena más baja por defecto y cada video puede tener su propio volumen.
- Las pantallas de los equipos muestran el contenido con la inclinación real del vidrio.

## 0.3.1 — Los videos hechos quedan a la vista

- La página Motion muestra el último video que hiciste (y el crédito de su música) apenas la abrís, no
  sólo justo después de hacerlo.

## 0.3.0 — Videos con motion graphics: un guion y unas fotos alcanzan

- Al crear un video ahora elegís el camino: **Motion graphics** (escribís el guion, subís unas fotos con
  una línea que diga qué muestran, y el Video Maker diseña las escenas animadas, pone la voz, elige la
  música y corta al ritmo) o **Material crudo** (el montaje de grabaciones de siempre).
- Página nueva **Motion** en cada video de motion graphics: marca, formato horizontal o vertical (reels),
  música, guion e imágenes; "Armar storyboard" te muestra las escenas antes de gastar tiempo en el video,
  y "Hacer video" muestra el avance ("Voz 3/7", "Render…") y el reproductor al terminar.
- El productor también sabe armar videos de motion graphics desde la conversación.
- La marca DisplayAds viene con sus equipos (Counter 15 y el nuevo Easy Pro) y sus fotos aprobadas.
- El crédito de la música ya no aparece sobre el video: queda en un archivo `.credits.txt` al lado del
  MP4 para que lo pegues en la descripción de la publicación (la licencia de los temas lo pide).
- Claude se usa siempre con tu suscripción, y cada llamada es mucho más barata: ya no carga la
  configuración de Claude Code de tu máquina.

## 0.2.0 — Storyboard sin Claude y material libre para B-roll

- El storyboard (la propuesta de escenas del video: qué se dice y qué se ve en cada una) ahora también funciona con OpenRouter — ya no
  hace falta tener Claude conectado para generarlo, alcanza con cualquiera de los dos motores.
- El productor puede buscar y traer video y fotos libres para B-roll desde Wikimedia Commons y
  la biblioteca de NASA, directo desde la conversación — el crédito de cada uno se guarda solo
  en el archivo de créditos del proyecto.
- El productor ahora puede mirar las fotos que subís, para armar mejor la Receta Publicidad.
- Arreglado: la voz generada fallaba cuando una frase tenía que acelerarse un poco para entrar en su
  tiempo, y los subtítulos podían perder las tildes al ajustar el logo o las placas.
- La web explica por qué no recomendamos los modelos gratis de OpenRouter y actualiza los precios.

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
