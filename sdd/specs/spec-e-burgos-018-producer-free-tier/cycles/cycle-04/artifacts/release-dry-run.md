# 0.2.0 — dry-run final (cycle-04 TASK-004)

> 2026-09-26. `NODE_ENV=production pnpm desktop:release` (sin `--publish`: no sube nada).

- `dist/desktop/Video-Maker-0.2.0-arm64.dmg` y el estable `Video-Maker-arm64.dmg`: 256.4 MB,
  sha256 `00ddbd2dea37a1a9ba7e73887e0bcc9302e91fd78dbca4a3650d936d649a71b7` (los dos).
- Notas del release tomadas de la sección `0.2.0` de `apps/desktop/CHANGELOG.md`.
- Servidor MCP empaquetado (`Resources/mcp/main.js`, `tools/list` por stdio): 18 tools; con `*` las
  que van sin `outputSchema` (devuelven imágenes): get_project_overview,probe_media,extract_frames*,list_voices,read_project_text,write_project_text,copy_asset,start_job,wait_for_job,cancel_job,get_timeline,put_timeline,patch_timeline,search_free_music,import_music,search_free_media,import_media,view_images*.
- App instalada con este build y abierta sobre `media/`: la página del proyecto no tiene scroll horizontal
  (`scrollWidth` 1280 = `clientWidth` 1280, ningún elemento con desborde horizontal) —
  `workspace-no-horizontal-scroll.png`.
- Las 13 producciones reales de display ads (`display-ads-productions.md`) se hicieron con los builds intermedios de
  este mismo ciclo; los cambios posteriores son de texto (prompt, web) y del bench.
