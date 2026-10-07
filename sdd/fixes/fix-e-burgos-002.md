# FIX-e-burgos-002 — Las llamadas al CLI `claude` de render-api cargaban la configuración de Claude Code de la máquina

| Campo         | Valor                |
| ------------- | -------------------- |
| **ID**        | FIX-e-burgos-002     |
| **Tipo**      | IMPROVEMENT          |
| **Severidad** | high                 |
| **Keyword**   | [IMPROVEMENT]        |
| **Fecha**     | 2026-10-07           |
| **Autor**     | e-burgos             |
| **Estado**    | implemented          |
| **Spec**      | N/A (repo-level)     |
| **Origen**    | Pedido del dev: aislar los spawns de `claude` de render-api como ya lo hace motion-studio (spec-e-burgos-020 cycle-03), sin romper el MCP `studio` del productor. |

## Problema

`claudeCliArgs` (agente IA) y `producerCliArgs` (productor) lanzaban `claude --print` heredando la
configuración del usuario: settings, plugins, hooks, CLAUDE.md, skills y, en el agente IA, todos sus
servidores MCP. Cada llamada pagaba ese contexto ajeno.

## Solución aplicada

- Agente IA: `--setting-sources '' --strict-mcp-config --no-session-persistence`.
- Productor: ya tenía `--strict-mcp-config` junto a su `--mcp-config`; suma `--setting-sources ''`.
  No lleva `--no-session-persistence` porque los turnos siguientes usan `--resume`.
- `libs/producer-tools/src/mcp/studio-mcp-launch.ts` arma el comando del servidor MCP, no una llamada
  a `claude`: sin cambios.

### Medición (2026-10-07)

| Llamada                          | Antes                                        | Después                                     |
| -------------------------------- | -------------------------------------------- | ------------------------------------------- |
| Agente IA (prompt + schema mínimo) | $0.6826 · 2 turns · 181 565 cache creation   | $0.0065 · 1 555 input · 0 cache creation    |
| Productor, primer turno real     | $0.0898 · 5 plugins · 214 skills · 21 174 cache creation | $0.0467 · 0 plugins · 8 skills · 9 131 cache creation |

En ambos casos el `system/init` del `stream-json` del productor muestra los mismos 18 tools
`mcp__studio__*` con `studio` conectado; el modelo llamó `get_project_overview` y un segundo turno
retomó la sesión con `--resume`.

### Archivos modificados

- `apps/render-api/src/ai/claude-cli-ai-agent.ts` y su spec.
- `apps/render-api/src/producer/claude-code-producer-agent.ts` y su spec.
- `sdd/fixes.json`, `sdd/fixes/fix-e-burgos-002.md`.

### Test de validación

- **Referencia:** `pnpm nx test render-api` en verde con specs nuevos que exigen los flags; turno real
  del productor antes/después sobre un media root descartable. Detalle en `sdd/fixes.json → test_reference`.

### Decisión del Reviewer

> [A completar por sdd-reviewer al cerrar el próximo ciclo]
>
> - [ ] `validated` — fix correcto, no requiere seguimiento
> - [ ] `absorbed` — debe formalizarse en próxima spec: SPEC-XXX
