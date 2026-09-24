# spec-e-burgos-017-desktop-app — cycle-04 · plan (lite)

> Módulo: desktop-app | Subproyectos: libs/producer-tools, apps/render-api, apps/web, apps/desktop | Fecha: 2026-09-24
> Flow: **lite** — decisión del dev (perfil `solo`). Un solo actor: escribe este plan, implementa
> task por task (con implementores delegados) y cierra como reviewer.
> Objetivo: que un amigo **sin Claude** pueda usar el productor con su API key de **OpenRouter**, con
> las mismas herramientas, las mismas recetas y la misma conversación que con el CLI `claude`.
> Fuera de alcance: la interfaz nueva centrada en el chat (`cycle-05`), cualquier otro proveedor que no
> sea OpenRouter, y cambiar el motor Claude (sigue siendo `claude -p` con el servidor MCP).

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C4-01 | **Vercel AI SDK 7 + `@openrouter/ai-sdk-provider` 3** en `libs/producer-tools` | Es lo acordado en la spec (D-04). El SDK maneja el bucle de herramientas, el streaming y la cancelación; el provider de OpenRouter declara soporte para Zod 4 |
| D-C4-02 | El runtime OpenRouter usa `createStudioToolHandlers` **en proceso**, sobre el mismo cliente HTTP que usa el MCP | Mismas validaciones, mismos errores tipados y mismo alcance por proyecto que el motor Claude, sin un segundo proceso |
| D-C4-03 | **Cambio de contrato:** `start_job` pasa a recibir `{ job: <unión por kind> }` | Una unión en la raíz se publica vacía por MCP (hallazgo de `cycle-01`) y los proveedores estilo OpenAI exigen un objeto en la raíz del schema de una herramienta. Envolverla arregla los dos motores de una vez; los únicos consumidores son nuestros |
| D-C4-04 | La API key vive en el **llavero de macOS** (`/usr/bin/security`, servicio `Video Maker`, cuenta `openrouter`), escrita y leída por `render-api` | La ventana del estudio no tiene acceso a Electron, y así funciona igual en la app y en `pnpm studio`. La key nunca vuelve en un payload: la API solo informa si está cargada |
| D-C4-05 | El historial para OpenRouter se **reconstruye desde la base** (mensajes de usuario y del productor, más un resumen de las herramientas de cada turno), recortado al presupuesto de contexto del modelo | Claude retoma su sesión con `--resume`; OpenRouter no tiene sesión del lado del proveedor |
| D-C4-06 | **Lista curada** de modelos, elegida con un benchmark real y no por reputación | El productor encadena decenas de llamadas a herramientas; un modelo que falla en eso rompe la receta. La lista y sus resultados quedan en un artefacto |
| D-C4-07 | Motor por defecto: Claude si el CLI está disponible y logueado; si no, OpenRouter si hay key | Nadie tiene que configurar nada si ya tiene uno de los dos |
| D-C4-08 | Cada turno de OpenRouter registra `usage` y costo en USD que informa OpenRouter, visible en el turno | Es plata de tu amigo: tiene que poder ver cuánto le costó un video |

## Historias

- **US-017-301 — Un schema real para `start_job`.** CA: `tools/list` del MCP publica el schema completo
  de `start_job`, con `job` como unión por `kind`; el prompt y los ejemplos usan la forma nueva; un turno
  real con Claude (Haiku) inicia un job sin rechazos de forma.
- **US-017-302 — Cargar la key sin riesgo.** CA: desde la web se pega la key, se guarda en el llavero y
  la pantalla muestra solo "key cargada" más los últimos 4 caracteres; borrarla la saca del llavero;
  una key inválida se detecta con una llamada barata a OpenRouter y se informa.
- **US-017-303 — El productor con OpenRouter.** CA: con el motor OpenRouter, un turno usa las mismas
  herramientas del estudio y deja la misma conversación persistida, los mismos eventos legibles y las
  mismas sugerencias que con Claude; se puede cancelar; `extract_frames` le llega al modelo como imagen
  en los modelos que la aceptan.
- **US-017-304 — Elegir motor y modelo.** CA: la web permite elegir el motor por defecto y el modelo;
  el selector del chat muestra los modelos del motor activo; `/health` informa qué motores están listos
  y el productor queda disponible si al menos uno lo está.
- **US-017-305 — La key nunca se filtra.** CA: después de un turno real, un `grep` de la key sobre la
  base, los logs, `work/producer/` y las respuestas de la API no encuentra nada.
- **US-017-306 — Modelos que funcionan.** CA: la lista curada tiene entre 2 y 4 modelos que completaron
  el escenario del benchmark; cada uno con su tasa de éxito, pasos, latencia y costo por corrida.

## Tasks (detalle en tasks.json)

- **TASK-001** — `start_job` envuelto en `{ job }`.
- **TASK-002** — Llavero y endpoints de configuración del productor.
- **TASK-003** — Runtime OpenRouter en `libs/producer-tools`.
- **TASK-004** — Ruteo por motor en `render-api`.
- **TASK-005** — Configuración en la web.
- **TASK-006** — Benchmark de modelos y lista curada.
- **TASK-007** — Verificación real en la app empaquetada.
- **TASK-008** — Cierre.

## Verificación

- `pnpm nx run-many -t lint test build` en verde, cobertura ≥ 80%.
- **Benchmark (TASK-006):** escenario fijo sobre una copia de un proyecto real: inventario, medir el
  A-roll, mirar 3 frames, escribir un guion con marcas de tiempo y lanzar el job de voz. De 6 a 8
  candidatos, 2 corridas cada uno, con un **tope de gasto total de USD 3**.
- **Receta Tutorial con OpenRouter (TASK-007)** en la app empaquetada, con el modelo por defecto de la
  lista: MP4 verificado por `nb_frames`, secuencia de herramientas comparada con la corrida de Claude de
  `cycle-03`, y el `grep` de la key en todo lo que persiste la app.

## Riesgos del ciclo

| Riesgo | Mitigación |
| --- | --- |
| Hace falta una API key de OpenRouter con saldo para probar | La carga el dev desde la web o con `security add-generic-password`; **nunca por el chat**. Tope de gasto por corrida y total |
| Un modelo barato no sigue las recetas | Por eso el benchmark; el modelo por defecto sale de ahí |
| Las imágenes de `extract_frames` no llegan en algunos modelos | La lista curada marca qué modelos aceptan imágenes; para los demás, `extract_frames` devuelve solo texto y el prompt lo sabe |
| El historial reconstruido supera el contexto | Recorte por presupuesto con los mensajes más recientes completos y un resumen de los anteriores |
