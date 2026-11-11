# Herramientas de audio para el productor: Openverse, Real SFX y Earshot

> Fecha: 2026-11-10 · Tipo: análisis, sin implementación · Si se implementa, va como FIX GATE.

Objetivo del dev: que el productor **busque** el sonido, lo **ubique en su cuadro** y lo
**escuche** antes de entregar el video. Cada herramienta cubre una de esas tres partes.

## 1. Cómo estamos hoy (lo que encontré en el repo)

- **Música:** búsqueda en Wikimedia Commons (`apps/render-api/src/music/commons-music-search.ts`),
  normalizada a -16 LUFS y mezclada con los niveles del preset (ducking en `audioMix`). Los créditos
  van a `work/credits.json` (`kind`: `music` | `video` | `image`) y de ahí a la descripción de
  YouTube (`apps/render-api/src/youtube/publish-credits.ts`).
- **Medios visuales:** Commons + NASA (+ Pexels con key) en `apps/render-api/src/media-search/`.
- **Efectos de sonido:** el SKILL.md dice que el motor "no hace efectos de audio", pero eso es
  verdad solo a medias:
  - El modo B (motion graphics, `libs/motion-graphics`) traía **8 SFX empaquetados** de HyperFrames
    (`assets/runtime/sfx/`: chime, click-soft, impact-bass-1, notification, pop, riser, whoosh,
    whoosh-short) y ya usaba uno: el impacto del arranque (`compose/impact-sfx.ts`), con
    automatización de volumen que lo baja bajo la voz. *Corrección del 2026-11-11:* esos archivos
    eran de Pixabay, no Apache 2.0 (el Apache cubre solo el código de HyperFrames), y su licencia no
    permite distribuirlos sueltos. Se reemplazaron por el banco CC0/CC BY de `assets/sfx-bank/`
    (FIX-059 y FIX-062) y se borraron (FIX-065).
  - El storyboard ya le pide al modelo `sfxTags` por escena ("palabras en inglés para buscar en una
    librería de audio stock", `build-storyboard-prompt.ts`), pero **nadie los consume**: se generan
    y se tiran.
  - El modo A (Remotion, A-roll + B-roll) no tiene pista de efectos.
- **Revisión:** `apps/render-api/src/review/` mide el margen voz/música por segmento y **ya suma la
  potencia de los SFX** (`voice-music-margin-rule.ts`, `motion-sfx-cues.ts`, `motion-level-plans.ts`).
  Ojo: el umbral crítico es **10 dB** y los 15 dB son solo "sugerencia"
  (`review-thresholds.ts`). La regla del dev (≥15 dB bajo la voz) hoy no bloquea.
- **Lo que la revisión no hace:** escuchar. Mide loudness, silencios, negros y congelados, pero no
  sabe *qué* suena ni si un efecto cae tarde respecto del corte, ni si se repite.

## 2. Qué es cada herramienta, de verdad

| | **Openverse** | **Real SFX** (Clipwing) | **Earshot** (Leon Lin) |
|---|---|---|---|
| Qué es | Buscador de medios con licencia abierta de WordPress.org; API REST pública | Skill de Claude Code (scripts Python) que sonoriza un video con grabaciones reales **de tu propia librería** | Toolkit Python para que un agente "escuche": describe, compara, ubica eventos, critica la mezcla y genera SFX por código |
| ¿Coincide con la descripción del dev? | Sí: **5,22 M audios** (medido hoy en `/v1/audio/stats/`) con licencia y autor por ítem. Pero **3,99 M son de Wikimedia** (la fuente que ya usamos); lo nuevo es **Freesound (592 k)** y **Jamendo (645 k)** | Sí, ubica cada sonido en el cuadro y su `critique.py` penaliza la "ametralladora" (5+ iguales seguidos). **No trae librería** (solo 78 UI CC0) y no busca en la web | En parte. Califica contra un perfil de **7 films de lanzamiento** (no contra "lanzamientos profesionales" en general ni contra tutoriales). El 8/15 es del **generador de sonidos v1**, una persona, 15 pruebas: es azar (50 %), que es justamente el punto (no se distinguen) |
| Cómo se consume | HTTP `api.openverse.org/v1/audio/?q=…&license=…` | Copiar la carpeta a `~/.claude/skills/real-sfx` | `pip install` (Python 3.10+, torch CPU) → CLI, API Python y **servidor MCP** (`claude mcp add earshot …`) |
| Licencia de la herramienta | API gratis; contenido con la licencia de cada ítem (CC0, BY, BY-SA, **NC**, **ND**…) | Scripts MIT; uisfx CC0 | Código MIT; modelos CLAP (Apache-2.0) y AST (BSD-3) |
| Costo | Gratis | Gratis | Gratis (todo local, CPU) |
| Límites | Anónimo: **20 req/min y 200 req/día**, máx. ~240 resultados por búsqueda. Con token OAuth (gratis) suben | Requiere `ffmpeg-full` (drawtext, rubberband) y Python 3.9+ | Modelos de varios GB; cada llamada CLI carga modelos 20–40 s (con MCP quedan cargados) |
| Madurez | Alta (proyecto de WordPress, años en producción) | Media: proyecto chico de un autor, 189 self-checks; orientado a HyperFrames | Media-baja: 4,4 k estrellas, v0.4, un autor; el README documenta bien sus límites (Goodhart: optimiza contra sus propios modelos) |
| API keys / suscripción | Ninguna | Ninguna | Ninguna (la crítica con Gemini es opcional y no la usaríamos) |

## 3. Qué nos resuelve cada una

### Openverse → **buscar** · Recomendación: **ADOPTAR**

- **Problema real:** no tenemos de dónde sacar SFX (los 8 de HyperFrames se agotan rápido y
  repetirlos es la "ametralladora") y la música de Commons es poca y despareja.
- **Integración:** una fuente nueva `openverse-*-search.ts` en `media-search/` y `music/`, con el
  mismo contrato que Commons (`FreeMediaResult` / `CommonsMusicResult`), caché y descarga existentes.
  Filtros fijos: `license_type=commercial,modification` (descarta NC y ND, el canal es comercial) y
  `source=freesound,jamendo` para no duplicar Wikimedia. Sumar `sfx` a `CREDIT_KINDS` para que el
  crédito llegue solo a YouTube. Los `sfxTags` del storyboard pasan a ser la consulta.
- **Esfuerzo:** 1–2 días (búsqueda + filtro de licencia + `kind: sfx` + tests).
- **Riesgos:**
  - Openverse no verifica licencias: hay que guardar `foreign_landing_url` y tomar como válida la
    licencia de la fuente original. CC BY exige crédito: ya lo resuelve `credits.json`.
  - Los audios de Freesound vienen como **preview MP3 128 kbps**; el WAV pide login en Freesound.
    Para SFX cortos bajo voz alcanza; para música hay que medir.
  - Calidad muy despareja: sin "oídos" (Earshot) el productor elige por tags.
  - Límite anónimo de 200/día: con caché sobra; si no, token OAuth gratis.

### Real SFX → **ubicar** · Recomendación: **PROBAR (y adoptar sus reglas, no la skill entera)**

- **Problema real:** colocar cada efecto en su cuadro, con variedad y jerarquía, sin pisar la voz.
- **Por qué no adoptarla tal cual:** es un **post-proceso que devuelve otro MP4**. Se saltea el
  timeline, la revisión, los créditos y el estudio; además espera tu librería local y `ffmpeg-full`
  (nuestro `$FFMPEG_PATH` no la garantiza).
- **Lo que vale oro es su criterio**, fácil de llevar a código nuestro:
  - nada de 5+ sonidos iguales seguidos; "cuatro tomas de una grabación son un solo sonido";
  - golpe fuerte en a lo sumo **un tercio** de los cortes;
  - un momento grande = hasta 3 capas en 80 ms, no un archivo fuerte;
  - el sonido se ubica por su **ataque audible**, no por el inicio del archivo;
  - chequeo en mono (un efecto que se cancela desaparece en el parlante del celular).
- **Integración:** reglas nuevas en `review/` (`sfx-repetition`, `sfx-density`) y un ubicador de
  cues que convierta `sfxTags` + tiempos de escena en `<audio id="sfx-…">` (modo B ya los entiende).
  En paralelo, una prueba de la skill real sobre un video de modo B (tiene `from_hyperframes.py`)
  para comparar resultados.
- **Esfuerzo:** prueba 0,5 día; reglas + ubicador 2–3 días.
- **Riesgos:** dependencia de un autor; la skill no oye (decide por tags y espectrogramas).

### Earshot → **escuchar** · Recomendación: **PROBAR como paso opcional de la revisión**

- **Problema real:** la revisión automática deja pasar defectos que encontramos a mano. Earshot le
  da a la revisión algo que hoy no tiene: un `timeline` de lo que suena (evento, nivel, etiqueta,
  sincronía con los cortes), `realness`, y `sheet` (un PNG con frames, espectrograma y loudness que
  Claude sí puede mirar).
- **Integración:**
  1. Paso opcional en el job `review` (si existe `EARSHOT_PATH`), sin bloquear: `earshot timeline
     --video` → hallazgos "efecto 80 ms tarde respecto del corte", "zona sin cuerpo", etc.
  2. MCP de Earshot para el productor en Claude Code: antes de entregar, `describe`/`match` de cada
     SFX bajado de Openverse ("¿esto es un whoosh suave?") y `rank` para elegir el mejor de N.
  3. Su **banco de 252 SFX generados por código** (sin red, sin licencia de terceros) como fuente
     alternativa a Openverse. Hay que confirmar la licencia del audio renderizado (el código es MIT).
- **Esfuerzo:** instalación y prueba manual 0,5 día; paso en `review` 2–3 días.
- **Riesgos:**
  - `critique` compara contra films de lanzamiento con música al frente; un tutorial narrado va a
    "fallar" por diseño. Habría que armar **nuestro perfil** con `earshot profile` sobre 5–10 videos
    ya aprobados.
  - Peso: torch + modelos de varios GB y 20–40 s de carga; en la app desktop no se puede empaquetar,
    sería opcional y solo local.
  - Goodhart: si el mismo modelo genera y juzga, aprueba cosas que no suenan bien. El veredicto final
    sigue siendo la regla de dB y un oído humano.
  - No reemplaza la regla de 15 dB: la complementa.

## 4. Plan por etapas (si el dev lo aprueba, cada etapa es un FIX)

| Etapa | Qué | Resultado visible | Esfuerzo |
|---|---|---|---|
| 0 | Sin código nuevo: corregir el SKILL.md (modo B sí tiene SFX) y decidir si el margen de **15 dB pasa a crítico** en `review-thresholds.ts` | Lo que el productor promete coincide con el motor; el balance que pidió el dev bloquea | 0,5 día |
| 1 | **Openverse** como fuente de SFX (y música de respaldo) con filtro de licencia comercial y `kind: sfx` en créditos; consumir los `sfxTags` del storyboard | El productor busca efectos con crédito automático en YouTube | 1–2 días |
| 2 | **Ubicación** en modo B: cues desde `sfxTags` + tiempos de escena, reglas anti-ametralladora y de densidad tomadas de Real SFX en `review/` | Cada efecto en su cuadro, sin repeticiones | 2–3 días |
| 3 | **Earshot** opcional: MCP para el productor (elegir el mejor SFX) y paso no bloqueante en `review` con `timeline`/`sheet`; perfil propio con videos aprobados | El productor "escucha" antes de entregar | 2–3 días |
| 4 | Pista de SFX en modo A (Remotion), si las etapas 1–3 funcionan | Efectos también en tutoriales de pantalla | a estimar |

Orden sugerido: 0 → 1 → 3 (prueba manual) → 2. Escuchar antes de ubicar a ciegas.

## 5. Resumen para el dev

- **Openverse: adoptar.** Es gratis, sin key y trae lo que nos falta (Freesound y Jamendo, ~1,2 M
  audios útiles; el resto ya lo tenemos por Commons). Filtrar NC/ND y acreditar con el `credits.json`
  que ya existe.
- **Real SFX: probar, y sobre todo copiarle las reglas.** No conviene como skill que devuelve otro
  MP4: rompe el pipeline. Sus reglas de ubicación sí entran fácil en nuestra revisión.
- **Earshot: probar como "oídos" opcionales.** Es lo único que le da a la revisión la capacidad de
  escuchar, corre local sin API keys, pero pesa varios GB y su crítica viene calibrada para films
  de lanzamiento: hay que calibrarla con nuestros videos.
- **Música (sección 6):** el problema de las "dos piezas" es que la marca trae solo dos temas.
  Primer paso: un banco curado de 20–30 temas (Biblioteca de YouTube + Incompetech + Pixabay) con
  rotación; además, probar ACE-Step para tener música única por video.
- **Voz (sección 7):** mantener a Malena y reemplazar a Daniela. Primero una prueba a ciegas entre
  Chatterbox `es-mx-latam` (gratis, local), Azure Elena/Tomás (rioplatense, capa gratis) y Google
  Chirp 3 HD (1 M caracteres gratis por mes); la ganadora entra como tercer motor.
- **Antes de todo:** hoy el margen voz/música crítico es 10 dB, no 15. Si querés que 15 bloquee,
  es un cambio de una línea (etapa 0).

Todo esto va como FIX GATE si se aprueba; no se instaló ni se tocó nada.

## 6. Música: salir de las dos piezas

**Por qué hoy suenan siempre igual:** la marca Display Ads trae solo dos temas de Kevin MacLeod
(`libs/motion-graphics/assets/brands/displayads/music/`: *Voxel Revolution* y *Newer Wave*, CC BY 4.0).
Los videos de motion graphics salen siempre con alguno de esos dos. La búsqueda en Commons existe,
pero trae poca música útil para tutoriales.

| Fuente | Qué ofrece | Licencia para un canal comercial | API | Riesgo de reclamo en YouTube | Veredicto |
|---|---|---|---|---|---|
| **Biblioteca de audio de YouTube** | Miles de temas por género, ánimo y duración | Libre en YouTube; algunos piden atribución | No (descarga a mano desde YouTube Studio) | El más bajo: es de YouTube | **Adoptar** para armar el banco curado |
| **Incompetech** (Kevin MacLeod) | Catálogo grande, el mismo autor que ya usamos | CC BY 4.0, uso comercial con crédito | No (descarga directa, metadatos por ánimo) | Bajo | **Adoptar**: misma licencia y mismo crédito que hoy |
| **Pixabay Music** | Catálogo grande y moderno, buen nivel para fondos | Licencia Pixabay: comercial, sin crédito | No (la API de Pixabay es solo de imágenes y video) | **Medio**: algunos autores registran sus temas en Content ID | **Probar**, con temas elegidos a mano y guardando la constancia de licencia |
| **Jamendo** (directo o vía Openverse) | ~645 k temas | Licencia CC de cada artista; Jamendo cobra el uso comercial con su propio plan | Sí (`client_id` gratis) | Medio | **Probar** solo temas CC BY / CC0 vía Openverse |
| **Free Music Archive, ccMixter** | Catálogos CC | Licencia por tema; mucho NC | FMA ya no tiene API pública | Medio | Descartar como fuente automática |
| **Musopen** | Clásica en dominio público | Dominio público / CC | No | Bajo | Nicho: solo si un video pide clásica |
| **ACE-Step 1.5** (generación local) | Música instrumental nueva por prompt, ilimitada y única | MIT según la mayoría de las fuentes (la 1.0 era Apache 2.0; **confirmar en el repo oficial**) | Local (Python; en Mac corre con Metal/MPS, más lento sin GPU) | Nulo: el tema no existe en ninguna otra parte | **Probar**: puede dar un tema distinto por video |
| MusicGen (Meta) | Generación local | Pesos CC BY-NC | — | — | Descartar (no comercial) |

**Propuesta:**
1. **Banco curado de la marca** (sin código nuevo en el motor): 20–30 temas de la Biblioteca de
   YouTube + Incompetech + Pixabay, clasificados por ánimo y BPM (tranquilo, corporativo,
   animado, tecnológico), con `CREDITS.md` y la constancia de licencia de cada uno. Más una regla de
   rotación: no repetir el tema dentro de la misma lista ni en videos seguidos.
2. **Selección por ánimo:** el storyboard ya genera `musicTags`; que el productor elija del banco
   por esos tags en vez de usar siempre los dos temas fijos.
3. **ACE-Step como prueba aparte:** generar 5 fondos instrumentales y compararlos a ciegas con
   temas del banco. Si pasan, música única por video sin ningún riesgo de reclamo.

Esfuerzo: banco + rotación 1 día (casi todo es curaduría); selección por tags 1 día; prueba de
ACE-Step medio día.

**Resultado (2026-11-10, FIX-e-burgos-038).**

- **ACE-Step, descartado.** Corre en la M2 Pro de 16 GB, pero cuesta mucho:
  - 6,3 GB de modelos;
  - 3,8 minutos para arrancar;
  - 3,2 minutos por cada 90 segundos de música.
  
  Con bancos gratis de sobra, no vale la pena. Se borró del disco.
- **Pixabay, sin usar.** No hizo falta.
- **Cómo se eligió el banco.** Escuchando los temas mezclados bajo Daniela a −15 dB de la voz, en una página de prueba. Se eligieron 35 temas por tipo de video:
  - `tutorial`: 13;
  - `product`: 11;
  - `vertical`: 7;
  - `institutional`: 4.
- **Incompetech y Jamendo: 16 temas en la marca Display Ads.** Más los 2 que ya estaban, a 96 kbps. CC BY permite redistribuirlos, así que viajan en el repo y en el instalador.
- **Biblioteca de YouTube: 19 temas solo locales.** Se bajaron con el filtro «No requiere atribución». Su licencia no permite redistribuir los archivos, y el repo y el instalador son públicos. Por eso viven en `brands/.local-music/displayads/`, fuera de git, y el studio los suma a la marca solo en la Mac que los tiene.
- **Selección por tipo de video.** Cada tema declara sus `videoTypes`:
  - Motion elige según el formato o el tipo de video y evita los tres últimos temas usados por la marca. El uso se registra en `media/.music-usage.json`.
  - En los tutoriales grabados, `search_free_music` devuelve primero el banco de la marca, empezando por el tema usado hace más tiempo.
- **BPM.** Los temas sin BPM publicado se midieron con un estimador propio, validado contra los BPM de Incompetech. Los que dieron más de 160 se pasaron a la mitad.

## 7. Voz: alternativas a Daniela

**Hoy:** dos motores (`synthesize-voice-dispatch.ts`): **Piper** con *Daniela* (`es_AR`, gratis y
local, la que falla) y **ElevenLabs** con *Malena* (plan Starter, la voz de la marca). Piper no tiene
otra voz rioplatense: las otras voces en español son de México o de España.

| Opción | Acento | Costo y límites | Licencia / términos | Corre con la suscripción, sin keys de Anthropic | Veredicto |
|---|---|---|---|---|---|
| **Chatterbox Multilingual V3 + pack `es-mx-latam`** (Resemble AI) | Latino neutro; clona una voz desde una muestra de pocos segundos | Gratis, local, modelo de 0,5 B | **MIT**; cada audio lleva marca de agua inaudible (PerTh). **El repo quedó archivado**: sin soporte ni actualizaciones | Sí (local) | **Probar primero**: es la mejor candidata gratis. Clonar solo una voz con consentimiento (la del dev o una locutora contratada), nunca a Malena |
| **Azure Speech** (`es-AR-ElenaNeural`, `es-AR-TomasNeural`) | **Rioplatense real** | Capa gratis F0, del orden de 0,5 M caracteres neurales por mes (**confirmar en la página de precios**) | Términos comerciales de Microsoft | Sí; key de Azure, no de Anthropic | **Probar**: es la única voz neural argentina oficial y gratis que encontré |
| **Google Cloud TTS (Chirp 3: HD)** | Español de EE. UU. / latino | **1 M caracteres gratis por mes** (página oficial), después US$30 por millón; WaveNet: 4 M gratis | Comercial; pide facturación activa | Sí; key de Google. Ya hay un proyecto de Google Cloud para YouTube, pero conviene uno aparte | **Probar** como segunda opción: muy natural, aunque no rioplatense |
| **Kokoro-82M** | Español de España (1 voz femenina, 2 masculinas) | Gratis, local, liviano | Apache 2.0 | Sí | Descartar para la marca (no tiene acento local) |
| **MeloTTS** | Español genérico | Gratis, CPU | MIT | Sí | Descartar: calidad por debajo de Chatterbox |
| **Coqui XTTS-v2, F5-TTS, Fish Speech** | Clonan bien | Gratis | Pesos **no comerciales** (CPML, CC BY-NC) | — | Descartar |
| **edge-tts** (voces de Edge sin key) | Las mismas voces es-AR de Azure | Gratis | Uso no oficial de un servicio de Microsoft; puede cortarse en cualquier momento | — | Descartar para producción |
| **ElevenLabs Starter** (ya contratado) | Malena | Plan actual | Comercial | Sí | **Mantener** como voz principal de la marca |

**Propuesta:** dejar Malena como voz de la marca y **reemplazar a Daniela como voz gratis**. El
motor de voz ya está pensado para varios motores, así que sumar uno es otra entrada en el dispatcher.

1. **Prueba a ciegas** (medio día, sin código del producto): el mismo guion de un tutorial real
   leído por Chatterbox `es-mx-latam`, Azure Elena/Tomás, Google Chirp 3 HD, Daniela y Malena.
   El dev elige de oído; la revisión mide loudness y silencios igual que hoy.
2. **El motor ganador** entra como tercer motor en `synthesize-voice-dispatch.ts`, con la
   alineación de captions que ya existe (`transcribe-voice-script-lines.ts`). Esfuerzo: 1–2 días.
**Primera ronda de la prueba (2026-11-10), solo voces gratis.** Malena queda afuera porque
ElevenLabs es pago. Guion: tutorial de Turnos de opticagestion (7 frases, voseo). Las tomas
están en `media/_pruebas/voces-gratis/`, junto con los scripts que las generan
(`scripts/gen_local.py`, `scripts/gen_cloud.py`, `scripts/build_page.py`). Todas están
normalizadas a −16 LUFS. Control objetivo con el Whisper del studio:

| Voz | Duración | Lo que dice Whisper |
|---|---|---|
| Piper · Daniela (es-AR) | 39,7 s | La marca se pierde: «Blayas, Word para negocios» en vez de «Display Ads, webs para negocios» |
| Piper · Claude (es-MX) | 48,5 s | Todas las frases bien, la marca bien |
| Chatterbox V3 · pack latino, voz por defecto | 46,4 s | Todas las frases bien, la marca bien |

Notas técnicas de Chatterbox: el pack latino no carga tal cual con `chatterbox-tts` 0.1.7 de PyPI.
Hay que darle los nombres de archivo que espera, y cargar el decodificador v3 sin modo estricto:
le faltan solo dos buffers que se recalculan al iniciar. La marca de agua necesita
`setuptools<81`. Corre en la GPU de la Mac (MPS). Pesa unos 3,3 GB.

Falta sumar Azure (Elena y Tomás) y Google Chirp 3 HD. Tienen capa gratis, pero piden una cuenta
con key que tiene que crear el dev. Con `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` o
`GOOGLE_TTS_API_KEY` en el entorno, `gen_cloud.py` genera esas tomas y `build_page.py` las suma
a la página.

3. Si gana Azure o Google: guardar la key en el `.env` raíz como las demás y respetar el tope gratis
   con el mismo error de cuota que ya existe para ElevenLabs (`VOICE_ENGINE_QUOTA_EXCEEDED`).

**Veredicto de la escucha a ciegas (2026-11-10).**

| Voz | Resultado |
|---|---|
| Daniela | Gana, pero pronuncia mal «Display Ads» |
| Chatterbox latino | Pronuncia bien la marca, pero no suena argentina |
| Claude (es-MX) | Muy mala |

**Arreglo de la pronunciación (FIX-e-burgos-037).** Con las voces Piper en español, la narración reescribe «Display» como «Díspley» antes de sintetizar.

- **Cómo se eligió la variante.** Entre siete, a ciegas. Se miraron además los fonemas con el `espeakbridge` de piper usando el `espeak-ng-data` de la voz: «Díspley» da `dˈisplˌeɪ`.
- **Qué no cambia.** El guion, los subtítulos y Malena (ElevenLabs), que ya la pronuncia bien.
- **Control.** En una síntesis real, Whisper oye «Display As».
- **Decisión.** Daniela sigue como voz gratis, Malena como voz de la marca, y Chatterbox queda descartado.

## Fuentes

- Openverse: [API](https://api.openverse.org/v1/), [estadísticas de audio](https://api.openverse.org/v1/audio/stats/) (consultadas el 2026-11-10; límites leídos de los headers `x-ratelimit-*`).
- Real SFX: [Clipwing/skills — real-sfx](https://github.com/Clipwing/skills/tree/main/skills/real-sfx), [clipwing.pro/skills/real-sfx](https://clipwing.pro/skills/real-sfx).
- Earshot: [Leonxlnx/earshot](https://github.com/Leonxlnx/earshot), [anuncio del autor](https://x.com/LexnLin/status/2110878517197975717). No confundir con [arunash/earshot](https://github.com/arunash/earshot) (benchmark de agentes de voz telefónicos).
- Música: [guía de licencias 2026 (Foximusic)](https://www.foximusic.com/blog/royalty-free-music-for-commercial-use-guide/), [comparativa de sitios (Sonilo)](https://sonilo.com/blog/comparisons/best-royalty-free-music-sites-2026), [APIs de música libre](https://bingqiangzhou.github.io/posts/royalty-free-music-sites/), [ACE-Step 1.5 (README)](https://cdn.jsdelivr.net/gh/ace-step/ace-step-1.5@main/README.md), [ACE-Step 1.5 en Mac M2](https://en.bioerrorlog.work/entry/ace-step-15-local-m2-macbook).
- Voz: [Chatterbox (README, pack `es-mx-latam`, PerTh)](https://github.com/resemble-ai/chatterbox), [voces de Kokoro](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md), [precios de Google Cloud TTS](https://cloud.google.com/text-to-speech/pricing), [licencia de XTTS-v2](https://www.promptquorum.com/power-local-llm/local-tts-voice-cloning-piper-coqui-xtts), [comparativa de TTS open source (BentoML)](https://www.bentoml.com/blog/exploring-the-world-of-open-source-text-to-speech-models).
- Reseñas de las tres: [freshstack.ai](https://www.freshstack.ai/resources/claude-code-sound-effects), [Vivian Lin](https://vivian.hobbyland-group.com/en/article/free-sound-effects-claude-video-openverse-real-sfx-earshot).
