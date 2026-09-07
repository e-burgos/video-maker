# Constitución — tools/render-cli

> Versión 1.0 | Última actualización: cycle-0 (inicial) | Fecha: 2026-09-07
> Creada por el orquestador al abrir `cycle-01` de `spec-e-burgos-002-auto-montage-pipeline`.
> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/`.

## 1. Propósito

- **Tipo:** tool Node ejecutable (CLI headless)
- **Rol en el sistema:** la única interfaz de línea de comandos del motor. Va de una carpeta de
  assets (`media/<project-slug>/`) a un MP4 en `out/`, encadenando `libs/auto-montage` y
  `@video-maker/composition-remotion/render`. **No contiene lógica de montaje propia**: si un
  cálculo hace falta, va a una lib, no acá.

## 2. Stack tecnológico

- TypeScript estricto (ESM, Node ≥ 22)
- `@video-maker/auto-montage` + `@video-maker/composition-remotion/render`
- Parser de argumentos: `node:util parseArgs` si alcanza (preferido, cero dependencias); cualquier
  paquete externo lo justifica el arquitecto
- Vitest sobre la lógica de parseo y armado de opciones; el render real es smoke manual

## 3. Estructura y patrones

> La define el ciclo `cycle-03` de la spec. Esquema previsto:

- `src/main.ts` — entry point, resuelve el comando y traduce errores a exit codes
- `src/commands/` — un archivo por comando: `ingest`, `plan`, `render`, `run`
- `src/args/` — parseo y validación de argumentos (puro, testeable)

## 4. Convenciones propias

- **El render pasa `publicDir` apuntando a la raíz del proyecto de medios** y `outPath` dentro de
  `out/` — es lo que mantiene `assetSrc` en su rama verificada (ver D-2 de la spec).
- **Exit codes**: 0 solo en éxito completo; cualquier fallo devuelve ≠ 0 con un mensaje que
  identifica etapa, asset y causa. Nunca un stack pelado.
- **Nada de I/O oculto**: la CLI es la capa que resuelve rutas y variables de entorno y se las pasa
  explícitas a las libs.
- **Sin comentarios** en el código; nombres declarativos, funciones cortas.
- Tags Nx y boundaries: los define el arquitecto (es el primer `tools/` del repo).
- Regla operativa heredada de `spec-001`: transcribir **antes** de renderizar, nunca en paralelo
  (16 GB compartidos entre Chrome Headless Shell, ffmpeg y el modelo Whisper).
