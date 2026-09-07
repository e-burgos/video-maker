# media-local

Lib Node de I/O acotada: envuelve `ffprobe`, `ffmpeg` y `whisper-cli` detrás de un
`CommandRunner` inyectable y convierte su salida a los contratos de
`@video-maker/timeline-core`. Sin base de datos, sin endpoints HTTP, sin UI.

Se importa por source vía el alias `@video-maker/media-local`.

En CI no corre ningún binario (RN-9, RNF-3): todo lo que ejecuta procesos vive detrás de
`CommandRunner`, y `FixtureCommandRunner` reemplaza los binarios reales en los tests.

## Comandos

```bash
pnpm nx lint media-local
pnpm nx test media-local
pnpm nx build media-local   # tsc -p tsconfig.lib.json — typecheck + .d.ts, sin bundler
```

## Binarios externos y variables de entorno

| Binario | Variable de entorno | Versión mínima |
| --- | --- | --- |
| `ffmpeg` | `FFMPEG_PATH` | 6.0 |
| `ffprobe` | `FFPROBE_PATH` | 6.0 |
| `whisper-cli` | `WHISPER_CPP_PATH` | 1.7 |
| modelo whisper (`ggml-*.bin`) | `WHISPER_MODEL_PATH` | — |

`resolveBinaries` prioriza la variable de entorno y, si no está fijada, busca el binario en
`PATH`. La resolución es un lookup puro sobre el filesystem (`fs.access`), nunca ejecuta
`--version`: la versión mínima se verifica a mano como parte del smoke manual.

Alcance POSIX (macOS/Linux): no se implementa `PATHEXT` ni resolución de `.exe`; en Windows hay
que fijar las cuatro variables de entorno.

## Fixtures

Los fixtures de `src/__fixtures__/` documentan de qué binario/versión salieron a medida que se
agregan en las tasks siguientes de este ciclo.

## Smoke manual

Antes de dar por buena una instalación local: `ffmpeg -version` y `whisper-cli --help` deben
correr y reportar versión ≥ la mínima de la tabla de arriba.
