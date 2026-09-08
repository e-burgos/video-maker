# Sprint Plan — Ciclo 01 — render-service (render-service-foundation)

> **Input:** `brief.yaml`, `functional.md`, `architect.md`
> **Output:** `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-01/planner.md` +
> `sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-01/tasks.json`
> **Generado por:** sdd-planner (claude/sonnet, effort medium)
> **Regla de este ciclo:** un solo implementador, tasks en secuencia estricta, ninguna en paralelo.
> Cada archivo del árbol de `architect.md` §2 cae en exactamente una task.

---

## Resumen

**Duración estimada:** 35h (~1 semana a jornada completa de un solo implementador)
**Story points totales:** 37
**Tasks:** 15 (`TASK-001`..`TASK-015`), todas `[BE]` — el ciclo no tiene frontend.

---

## Tabla de tasks

| Task | Título corto | HU | CA que cierra | SP | Horas | Depende de |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-001 | Scaffold + auditoría del generador + arranque real del harness | HU-1-01 | CA-001 (parcial) | 5 | 4 | — |
| TASK-002 | Tipos de puertos, tipos de motor y fixtures compartidas | HU-1-08 | CA-007 (habilita) | 3 | 3 | TASK-001 |
| TASK-003 | Configuración del servidor por variables de entorno | HU-1-02 | CA-002 (config) | 1 | 1 | TASK-001 |
| TASK-004 | Superficie de errores propia (códigos, etapas, subclase) | HU-1-06 | CA-004 (base) | 2 | 2 | TASK-001 |
| TASK-005 | Traducción de errores del motor (tabla §5.5) | HU-1-06 | CA-004 | 3 | 3 | TASK-004 |
| TASK-006 | Mapeo código→status HTTP y payload de máquina en inglés | HU-1-06 | CA-004 | 2 | 2 | TASK-005 |
| TASK-007 | Rutas de trabajo del pipeline (`work/renders/<id>`, `out/`) | HU-1-05 | CA-005 (paths) | 1 | 1 | TASK-001 |
| TASK-008 | `runRenderPipeline` (orden fijo, mkdir previo, intermedios, tolerancia) | HU-1-04, HU-1-05, HU-1-07 | CA-003, CA-005, CA-006 | 5 | 4 | TASK-002, TASK-005, TASK-007 |
| TASK-009 | Transporte HTTP agnóstico + router (404/405 explícitos) | HU-1-03 | CA-002 (router) | 2 | 2 | TASK-001 |
| TASK-010 | Handler de `GET /health` (ok/degraded, sin rutas resueltas) | HU-1-03 | CA-002 (health) | 2 | 2 | TASK-002, TASK-009 |
| TASK-011 | Manejador central de errores HTTP (sobre único) | HU-1-03, HU-1-06 | CA-002, CA-004 | 2 | 2 | TASK-006, TASK-009, TASK-010 |
| TASK-012 | Servidor `node:http` real sobre socket loopback | HU-1-02, HU-1-03 | CA-002 (socket) | 2 | 2 | TASK-011 |
| TASK-013 | Adaptador de producción (`await import()` dinámico) | HU-1-02, HU-1-04 | CA-002, CA-003 (adaptador) | 3 | 3 | TASK-002, TASK-008 |
| TASK-014 | `main.ts` (frontera de proceso) + verificación real de CA-002 | HU-1-02, HU-1-03 | **CA-002 (completo)**, CA-001, CA-007 (gates finales) | 3 | 3 | TASK-003, TASK-012, TASK-013 |
| TASK-015 | README del subproyecto | HU-1-09 | CA-008 | 1 | 1 | TASK-014 |

**Total:** 37 SP · 35h.

---

## Orden de ejecución justificado

El orden es un orden topológico válido sobre `depends_on` (cada dependencia tiene índice menor
que la task que la usa) y también la secuencia real que sigue el único implementador — no hay
ninguna task marcada para correr en paralelo con otra.

1. **TASK-001 primero, sin excepción.** Todo lo demás — incluida la infraestructura de test —
   necesita el proyecto Nx, sus `tsconfig`, `vite.config.ts` y el patrón de arranque
   (`server-register.cjs`) ya en pie. Su criterio de done exige además una prueba de **ejecución
   real** del harness (`node -r server-register.cjs <archivo>.ts` corre y termina en `exit 0` sobre
   un script descartable, no rastreado en `files[]`) — antes de construir lógica de negocio encima,
   hay que probar que "compilar no es ejecutar" no esconde un patrón roto. La verificación completa
   de CA-002 (proceso + HTTP real) es otra, y es la última de la cadena (TASK-014): acá sólo se
   prueba que el mecanismo de arranque funciona, no el servicio.
2. **TASK-002 (infraestructura compartida) va inmediatamente después**, por regla explícita del
   pedido: los tres archivos de `__fixtures__/` y los tipos de `deps/render-api-dependencies.ts` y
   `engine/*` tienen que estar cerrados antes de la primera task que los consume. Casi todo el resto
   del árbol — `run-render-pipeline.spec.ts`, `health-handler.spec.ts`,
   `node-render-api-dependencies.ts` — depende de estos tipos o del `call-log`/`fake-deps`.
3. **Tres ramas independientes se abren en paralelo lógico pero se ejecutan en secuencia estricta**
   (config, errores, rutas de trabajo): `TASK-003` (config), `TASK-004→005→006` (superficie de
   errores completa) y `TASK-007` (rutas de trabajo) sólo dependen de `TASK-001`. No hay forma de
   paralelizarlas con un solo implementador, así que el orden entre ellas (003, luego 004-005-006,
   luego 007) es arbitrario dentro de esa restricción — se eligió dejar la cadena de errores completa
   antes de abrir rutas de trabajo porque `run-render-pipeline` (TASK-008) es el primer consumidor de
   ambas y conviene cerrar la rama más larga (errores, 3 tasks) antes que la más corta (paths, 1
   task).
4. **TASK-008 (`runRenderPipeline`) es el corazón del ciclo** y no puede empezar hasta que las tres
   ramas anteriores (fixtures, traducción de errores, rutas de trabajo) estén cerradas: usa
   `createCallLog`/`createFakeRenderApiDependencies` para probar CA-003 y CA-006, `translateEngineError`
   para envolver cada etapa, y `resolveRenderPipelinePaths` para el layout. Es la task de mayor
   riesgo de secuencia (ver más abajo).
5. **La cadena HTTP (`TASK-009→010→011→012`) es estrictamente lineal**: transporte y router primero
   (no dependen de nada del pipeline), el handler de `/health` después (necesita los tipos de motor
   de TASK-002), el manejador central después (necesita el router, el health handler y el mapeo de
   errores→HTTP de TASK-006) y el servidor real al final (envuelve el manejador central sobre un
   socket). Ninguna de estas cuatro tasks depende de `runRenderPipeline`: por diseño de este ciclo
   (D-K del arquitecto) no hay ningún endpoint que dispare el pipeline, así que la cadena HTTP y la
   cadena del pipeline son ramas independientes que sólo convergen en `main.ts`.
6. **TASK-013 (adaptador de producción) depende de TASK-002 y TASK-008**: implementa los mismos siete
   puertos que `run-render-pipeline.spec.ts` ya probó con dobles, así que cerrar TASK-008 antes fija
   el contrato exacto que el adaptador tiene que satisfacer sin ambigüedad.
7. **TASK-014 (`main.ts`) es la convergencia final**: necesita la configuración (TASK-003), el
   servidor HTTP real (TASK-012) y el adaptador de producción (TASK-013). Es también la task que
   ejecuta el comando exacto de `architect.md` §10.1 (arranque real, `curl` a `/health`, `SIGTERM`,
   `exit=0`) y, por ser la última task de código, la que corre el gate completo del workspace
   (`pnpm nx run-many -t lint test build`, CA-001) y el umbral de cobertura (CA-007) con la suite ya
   completa.
8. **TASK-015 (README) va al final** porque documenta comandos y alcance de un servicio que recién
   en TASK-014 queda ejecutable de punta a punta; escribirlo antes arriesga documentar un comando que
   todavía no funciona.

---

## Riesgos de secuencia

- **TASK-001 es la de mayor superficie y la más fácil de dar por "hecha" sin estarlo.** El riesgo
  concreto que enumera el arquitecto (D-B, §11) es que `nx run render-api:test` reporte 100% de
  cobertura sobre cero archivos si el `coverage.include` no resuelve contra el `root` del proyecto.
  Mitigación: el criterio de done de TASK-001 exige correr `nx run render-api:test` con al menos un
  archivo `*.spec.ts` trivial (o esperar hasta TASK-003, el primer `*.spec.ts` real) y confirmar que
  el reporte de cobertura no queda vacío antes de dar la task por cerrada.
- **TASK-008 es el cuello de botella real del ciclo.** Concentra 5 SP y tres criterios de aceptación
  (CA-003, CA-005, CA-006) sobre el mismo archivo, y cualquier error de orden en el `call-log`
  (`ensureDirectory` dos veces, `renderMutedVideo` una sola vez pese a `withinTolerance: false`)
  rompe tres tests a la vez. Si el implementador nota que la task no cierra en las 4h estimadas, la
  señal correcta es partir la verificación (orden + mkdir por un lado, tolerancia/conservación por
  otro) en una sub-task nueva antes de forzar el commit — no ajustar el test para que pase.
- **TASK-013 no tiene test propio** (excluido de `coverage.include` por §7.5, sin fila en la lista
  cerrada de §9). Su única red de seguridad es la ejecución real de TASK-014. Si `main.ts` falla al
  arrancar, el primer sospechoso es el adaptador (imports dinámicos, orden de `resolveBinary`), no
  `main.ts` mismo — evita perder tiempo revisando la frontera de proceso cuando el bug está un nivel
  más abajo.
- **`eslint.config.mjs` nunca aparece en `files[]` de ninguna task** (D-9, descopado). Ninguna task
  de este plan lo crea ni lo edita; el contenido propuesto en `architect.md` §8.2 queda para que el
  dev lo pegue fuera del flujo del ciclo. Si alguna task futura necesitara ese archivo, es una señal
  de que el plan cambió y hay que escalarlo, no resolverlo por su cuenta.
- **La cadena de errores (TASK-004→005→006) y la cadena HTTP (TASK-009→010→011→012) son las dos más
  largas del plan (3 y 4 tasks respectivamente).** Un cambio de firma tardío en cualquiera de los
  tipos base (`RenderApiErrorCode`, `RenderApiErrorPayload`, `HttpResponse`) obliga a revisar todas
  las tasks posteriores de su cadena. `architect.md` ya cierra estas firmas exactas (§5.1, §6.1); si
  el implementador necesita desviarse de ellas, es una escalación al arquitecto, no una decisión de
  implementación.

---

## Qué NO está en ninguna task

Copiado 1:1 del `out_of_scope` del `brief.yaml` de este ciclo — ninguna task de este plan lo cubre,
ni parcial ni como efecto colateral:

- Cola de jobs, concurrencia, progreso y cancelación — se entregan en `cycle-03`.
- Endpoints de assets, upload, probe y persistencia de `Timeline`/EDL — se entregan en `cycle-02`.
- MinIO, docker-compose y cualquier cliente S3 — se entregan en `cycle-02` (decisión D-3).
- Dependencias npm nuevas de cualquier tipo (RNF-1, decisión D-2).
- Crear `apps/render-api/eslint.config.mjs` — descopado por el hook `config-protection` del harness
  del dev (decisión D-9); el contenido propuesto vive en `architect.md` §8.2 para que el dev lo pegue
  fuera de este ciclo.
- Tocar `tsconfig.base.json` — una app no necesita alias propio; si hiciera falta se escala con el
  diff correspondiente (RNF-5).
- Tocar `tools/render-cli` — su superficie de errores con token genérico y su salida bilingüe se
  agendan para `cycle-03` (decisión D-5).
- Tocar `coverage.include` de `libs/composition-remotion` — se amplía en `cycle-03` (decisión D-6).
- Bundlear Remotion con webpack: queda declarado explícitamente como NO verificado en este ciclo
  (decisión D-10) — ninguna task ejercita `bundleProject`/`selectComposition`/`renderMedia`; se
  ejercita recién en el smoke E2E obligatorio de `cycle-03`.
- Re-master del integrado del bus completo — fuera del alcance de la spec por ahora (spec-004,
  decisión D-K).
- Ningún endpoint que dispare `runRenderPipeline` por HTTP: `POST /render` no existe en este ciclo
  (decisión D-K del arquitecto) — `TASK-008` deja la función lista y probada, pero sin ruta.
- Parseo de cuerpo de request: ningún route del ciclo lo necesita.

---

## Registro de consumo

Entrada de este agente pusheada a `cycle.json → metrics.usage.by_agent[]`:

```json
{
  "agent": "planner",
  "provider_model": "claude/sonnet",
  "effort": "medium",
  "tokens_in": 0,
  "tokens_out": 0,
  "approx": true,
  "source": "declared-estimate",
  "recorded_at": "2026-09-08"
}
```

> Tokens en 0 como placeholder de la estimación declarada — el dev corrige al número exacto al
> cerrar la sesión, según la nota del pedido.
