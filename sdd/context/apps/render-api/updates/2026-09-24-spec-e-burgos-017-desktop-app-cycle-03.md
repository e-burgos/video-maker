# spec-e-burgos-017-desktop-app cycle-03 — 2026-09-24

## Estado
Corre como JavaScript (`render-api:bundle`, CJS, externals better-sqlite3 y `@remotion/*`) con el Node de
Electron. Sirve la web y la API bajo `/api` cuando `RENDER_API_WEB_ROOT` está seteada, y con
`RENDER_API_ACCESS_TOKEN` exige la cookie `vm_session` o el header `x-studio-token` y un `Host` local.
El motor de voz es sherpa-onnx (`ttsCli`/`ttsVoicesDir` reemplazan a `piperCli`/`piperModel` en `/health`).

## Estructura
- `http/static-web-handler.ts` y `http/local-access-guard.ts`; `GET /health` sin prefijo sigue siendo un caso
  especial para el proceso de Electron.
- `config/remotion-config.ts` (`REMOTION_SERVE_URL`, `REMOTION_BROWSER_EXECUTABLE`): el bundle precompilado se
  copia una vez a `<dir de la base>/remotion-bundle/<hash>/` y cada render re-apunta `public` al proyecto, porque
  la Timeline guarda los assets relativos al proyecto (resueltos con `staticFile`).
- `config/child-process-env.ts`: `claude -p`, el servidor MCP y los binarios de media reciben un entorno
  permitido, nunca `process.env` completo. `process/`: watchdog de `VIDEO_MAKER_PARENT_PID` y limpieza de Chrome
  huérfano antes de matar su propio grupo.
- El `apiUrl` que se le pasa al productor incluye `/api` cuando la web está servida.
- `ProjectLayoutStats` informa `raw`/`out` por contenido, no por existencia de la carpeta.

## Dependencias
Sin dependencias nuevas propias; `STUDIO_MCP_ENTRY` lanza el MCP compilado.

## Qué sigue
Los 404 especulativos de `script.txt`/`script-manifest.json` en storyboard y voz siguen en la consola.
