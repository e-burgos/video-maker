# spec-e-burgos-007-web-montage cycle-02 — 2026-09-09

## Estado
El Web Studio deja de ser sólo consumidor de la `Timeline` y pasa a **producirla**: el flujo
completo (subir crudo → generar montaje → ajustar → renderizar → descargar) es alcanzable desde el
navegador y `tools/render-cli` deja de ser obligatorio. La biblioteca de assets tiene "Generate
montage" con preset y seed sobre `EP-012` `kind: 'montage'`, progreso por etapa
(`discover|probe|transcribe|plan`) por el mismo polling de los jobs de render, salto automático al
preview al terminar, y confirmación explícita ante `409 TIMELINE_ALREADY_EXISTS` que reintenta con
`overwrite: true`. El preview responde `TIMELINE_NOT_FOUND` con un estado vacío accionable en vez de
un error (`resuelve:` el hueco que dejaba una página muerta para un proyecto recién creado). El
badge de salud suma un disclosure con los cuatro binarios (nombre + `envVar`, nunca la ruta
resuelta) y las cuatro capabilities, y `montageBlockers()` deshabilita el botón con el motivo escrito
cuando el servicio no puede montar. Suite: **45 archivos / 357 tests**, 99,2 % stmts · 95,01 %
branch · 98,88 % funcs · 99,45 % lines, piso 80 % y `coverage.include` sin recortar. Cero
dependencias npm nuevas.

## Estructura
- `src/api/render-api-types.ts`: unión discriminada `Job = RenderJob | MontageJob` espejo de
  `apps/render-api/src/jobs/render-job.ts` (`kind`, `MontageJobProgress` con
  `processedAssets`/`totalAssets`, `MontageJobReport`, `MONTAGE_STAGES`, `MONTAGE_PRESETS` con los
  cuatro nombres de preset declarados en la app), `kind` en `RenderJobSummary` y `montageQueue` en
  `ServiceCapabilities`. Un campo opcional habría dejado leer `renderedFrames` de un job de
  montaje: por eso es unión, no un tipo con opcionales.
- `src/api/parse-render-job.ts`: `parseJob` es la entrada única; `parseRenderJob`/`parseMontageJob`
  estrechan y **rechazan** el otro `kind`.
- `src/api/montage-capability.ts`: `montageBlockers(health)` puro — el único lugar que decide si el
  servicio puede montar.
- `src/api/render-api-client.ts`: `createMontageJob(slug, { preset, seed, overwrite })`;
  `getRenderJob`/`cancelRenderJob` devuelven `Job`. `createRenderJob` sigue mandando **sin body**.
- Componentes nuevos: `MontageTrigger` (COMP-025) y `MontageJobPanel` (COMP-026), montados por
  `AssetLibraryPage`, que navega al preview con `useNavigate` cuando el job pasa a `succeeded`.
- **La suite no tiene `@testing-library/jest-dom`**: `toBeEnabled()`/`toBeDisabled()` fallan con
  `Invalid Chai property`. Aserar sobre `(el as HTMLButtonElement).disabled`.
- E2E: `e2e/smoke-helpers.mjs` (extraído de `studio-smoke.mjs`, ahora compartido) y
  `e2e/montage-smoke.mjs`, que corre desde **sólo `raw/`** hasta el MP4.

## Dependencias
Ninguna nueva. Consume de `apps/render-api` el contrato de `cycle-01` sin modificarlo:
`EP-001` (`capabilities.montageQueue` + 4 binarios), `EP-012` (`kind`, `preset`, `seed`,
`overwrite`, `409`), `EP-013`/`EP-014` (`kind` y las etapas propias del montaje).
`loadRootEnv()` del E2E lee del `.env` raíz **sólo** las cuatro variables de media y sólo si faltan.

## Qué sigue
- **`processedAssets`/`totalAssets` llegan siempre en `null`** (medido en dos corridas E2E): la UI
  ya los muestra, el que no los emite es el decorador del `CommandRunner` de `apps/render-api`.
  Candidato a `[FIX]` contra ese subproyecto.
- El listado de jobs (`RenderJobList`) muestra montajes y renders mezclados sin columna `kind`; el
  summary ya la trae. Cosmético, ningún CA lo pide.
- No hay cancelación de un job de montaje desde `MontageJobPanel` (`EP-015` la soporta).
- El montaje no refresca la biblioteca de assets antes de navegar: la fuente pasa de `raw-scan` a
  `catalog` y sólo se ve al volver.
