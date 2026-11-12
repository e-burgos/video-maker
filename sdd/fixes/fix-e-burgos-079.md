# FIX-e-burgos-079 — MCP externo y paquete npm

| Campo | Valor |
| --- | --- |
| **Tipo** | IMPROVEMENT |
| **Fecha** | 2026-11-12 |
| **Estado** | implemented |
| **Plan** | docs/plans/2026-11-12-plugin-video-maker.md |

## Solución
- Modo externo sin `--project`, `slug` por tool, alta de proyectos, material y marcas.
- Sin publicación ni borrados.
- `pnpm nx run producer-tools:pack-mcp` arma `@e-burgos/video-maker-mcp` (sin publicar).
