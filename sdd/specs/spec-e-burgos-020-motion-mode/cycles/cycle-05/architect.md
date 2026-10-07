# Architect — Cycle 5: Motion Mode (material-contract)

> **Input:** functional.md · **Generado por:** sdd-architect (actor único)

- **Contrato:** `sdd/skills/video-maker-material-contract/SKILL.md` sigue siendo la única fuente para
  proveedores externos; display-ads la consume por symlink. El modo B documenta el contrato HTTP de
  cycle-04 (`POST /projects {mode: motion}`, `PUT /motion/brief`, job `motion` con fases) y la CLI
  (`motion-studio auto`), con la misma tabla de errores que emite render-api.
- **Regla de modo:** A si hay que reproducir un flujo real de la UI; B si alcanza con entender la idea
  (presentación, función, equipo, promo, reel). Ambigua → se pregunta.
- **display-ads:** FIX de perfil solo (no crea contratos ni entidades): skill nueva en
  `.claude/skills/video-maker-request/`, estados del modo B (PENDIENTE → BRIEF → ENTREGADO → PRODUCIDO),
  retiro de `apps/video-manager` dejando intactos los registros históricos de specs y fixes. Se trabaja en
  un worktree (`feat/video-maker-modes`) para no tocar el trabajo sin commitear del dueño en `main`.
