# FIX-e-burgos-002-001 — `ProbeFailureErrorCode` breaks when `MediaLocalErrorCode` grows

> Tipo: `[BUGFIX]` · Severidad: `high` · Spec: `spec-e-burgos-002-auto-montage-pipeline` ·
> Detectado: 2026-09-08, al mergear la rama de spec-003/spec-004 sobre la de spec-002.

## Qué pasó

`libs/auto-montage/src/ingest/probe-assets.ts` declaraba

```ts
export type ProbeFailureErrorCode = 'BINARY_NOT_FOUND' | 'COMMAND_FAILED' | 'UNPARSEABLE_OUTPUT' | 'UNKNOWN';
```

y `errorCodeOf` devolvía `error.code` de cualquier `MediaLocalError` tal cual. Eso tipaba
porque, cuando se escribió (spec-002 cycle-01), `MediaLocalErrorCode` tenía exactamente esos
tres códigos: el tipo de `auto-montage` era una **copia** del union de `media-local`, no una
derivación ni una frontera.

spec-004 (audio mix & mastering) agregó `UNRESOLVED_AUDIO_ASSET` y `MISSING_MEDIA_STREAM` a
`MediaLocalErrorCode`. Cada rama compilaba sola; el merge de las dos rompió `auto-montage` y,
por transitividad, `tools/render-cli`:

```
libs/auto-montage/src/ingest/probe-assets.ts:45:37 - error TS2322:
  Type 'MediaLocalErrorCode' is not assignable to type 'ProbeFailureErrorCode'.
```

Es un conflicto **semántico**: git no lo marcó porque ningún archivo lo tocaron las dos ramas.

## Arreglo

Estrechar en la frontera en vez de ensanchar el contrato persistido:

- `PROBE_FAILURE_ERROR_CODES` como lista `as const`; `ProbeFailureErrorCode` se **deriva** de ella.
- `isProbeFailureErrorCode(code)` como type guard; `errorCodeOf` solo propaga códigos de esa
  lista y manda el resto a `'UNKNOWN'`.

Los códigos nuevos de spec-004 son de mezcla y mux, no de `ffprobe`: durante el probe no
pueden ocurrir, y si ocurrieran, `'UNKNOWN'` es exactamente el fallback que el catálogo ya
documenta. `work/catalog.json` no cambia de forma; ningún test existente cambió.

## Verificación

- `pnpm nx run-many -t build test -p auto-montage,render-cli` → verde (281 + 151 tests;
  `auto-montage` 98,7 % stmts / 93,07 % branches, sin bajar).
- Test nuevo en `probe-assets.spec.ts`: un `MediaLocalError` con código fuera de la lista
  (`MISSING_MEDIA_STREAM`) se mapea a `errorCode: 'UNKNOWN'`.

## Lección

Un tipo de una lib que replica el union de otra lib es una bomba de merge: compila en cada
rama y explota al juntarlas. O se deriva del origen (`import type`), o se estrecha en la
frontera con un guard sobre una lista propia. Nunca copiar el union.
