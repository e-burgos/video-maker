# spec-e-burgos-017-desktop-app — cycle-06 · plan (lite)

> Módulo: desktop-app | Subproyectos: apps/docs-site (nuevo), apps/desktop | Fecha: 2026-09-24
> Flow: **lite** — perfil `solo`, ejecutado sin aprobaciones intermedias a pedido del dev. **Publicar es
> irreversible**: crear el repo público, subir el sitio, habilitar Pages y el primer release (TASK-005) solo
> corren con la confirmación explícita del dev.
> Objetivo: que un amigo del dev entre a una web, baje el `.dmg` y lo instale siguiendo instrucciones claras,
> incluida la apertura de una app sin firmar (D-09, D-10 de la spec).

## Decisiones del ciclo

| # | Decisión | Por qué |
| --- | --- | --- |
| D-C6-01 | Versión **0.1.0** y un `.dmg` con **nombre estable** (`Video-Maker-arm64.dmg`) además del versionado | El link de descarga de la web (`releases/latest/download/Video-Maker-arm64.dmg`) no cambia entre versiones |
| D-C6-02 | `pnpm desktop:release` arma, calcula sha256 y redacta las notas desde `apps/desktop/CHANGELOG.md`; **sin `--publish` no publica nada** | Que ningún comando por error suba algo al repo público |
| D-C6-03 | **Cambio de destino (pedido del dev, 2026-09-25):** el sitio se publica en **Cloudflare Pages** (proyecto `video-maker`, dominio `video.estebanburgos.com.ar`) con una GitHub Action de este mismo repo, igual que `tucu-ui` (`pnpm dlx wrangler@4 pages deploy`, secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`). El `.dmg` va a un bucket **R2** (`video-maker-downloads`) y lo sirve una Pages Function en `/descargas/*` del mismo dominio. Reemplaza al repo público y a GitHub Releases | Todo queda en un repo, que sigue privado; Pages no acepta archivos de más de 25 MiB y el `.dmg` pesa 254 MB; R2 no cobra por descarga; un solo dominio para la web y la descarga |
| D-C6-04 | Sitio **estático sin dependencias de cliente** generado por un script de build de Node, en español | Es contenido, no una app: carga instantánea, cero riesgo de licencias, se publica tal cual en Pages |
| D-C6-05 | Capturas reales de la app (las del QA de `cycle-05` y la del diálogo de Gatekeeper que el dev compartió), no mockups | Tus amigos tienen que ver exactamente lo que van a ver |

## Historias

- **US-017-501 — Publicar una versión.** CA: `pnpm desktop:release` (dry-run) deja el `.dmg` versionado y el
  estable, sus sha256 y las notas; con `--publish` los sube al bucket R2 con `wrangler` y verifica que
  `/descargas/Video-Maker-arm64.dmg` responda con el mismo tamaño.
- **US-017-502 — Bajar la app desde una web.** CA: la web tiene un botón de descarga al último release, los
  requisitos (Mac con Apple Silicon, macOS reciente, espacio en disco, Claude o una API key de OpenRouter) y
  funciona en escritorio y en celular.
- **US-017-503 — Instalar sin ayuda.** CA: la guía de instalación explica paso a paso, con capturas, cómo abrir
  una app sin firmar (el diálogo "no se pudo verificar", Ajustes → Privacidad y seguridad → "Abrir igual"), la
  primera apertura con descargas, cómo cargar Claude u OpenRouter y qué cuesta, y una sección de problemas
  frecuentes (App Translocation, dónde están los datos, cómo desinstalar, dónde están los logs).

## Tasks (detalle en tasks.json)

- **TASK-001** — Versión, nombre estable y script de release.
- **TASK-002** — Sitio de documentación.
- **TASK-003** — Despliegue en Pages listo para copiar.
- **TASK-004** — Verificación real (build, links, capturas, release en dry-run).
- **TASK-005** — Publicar (**requiere la confirmación del dev**).
- **TASK-006** — Cierre del ciclo y de la spec.

## Verificación

- Build del sitio sin errores; todos los links internos y externos verificados; la URL de descarga con la forma
  correcta.
- Capturas del sitio a 1440 px y 390 px revisadas por el orquestador.
- `pnpm desktop:release` en dry-run produce el `.dmg` 0.1.0, el estable, los sha256 y las notas.
