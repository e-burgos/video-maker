# Functional — Cycle 5: Motion Mode (material-contract)

> **Input:** sdd/specs/spec-e-burgos-020-motion-mode/cycles/cycle-05/brief.yaml
> **Generado por:** sdd-functional (actor único)

## Historias

- **HU-01 — Un contrato, dos modos.** Como proyecto externo, sé por la skill del contrato qué modo pedir:
  CA-01: §0 decide A o B con una regla explícita; CA-02: §12 describe el modo B completo (brief, imágenes,
  guion, checklist, entrega por HTTP y CLI, errores) verificado contra el código del motor.
- **HU-02 — El modo B se entrega sin leer código.** CA-03: siguiendo §12.5 al pie de la letra se obtiene un
  MP4 (verificado con el reel 9:16 de cycle-04).
- **HU-03 — display-ads decide por video.** CA-04: la skill `video-maker-request` aplica la regla, delega el
  modo A a `platform-video-capture` y arma el paquete del modo B; el índice declara modo y estados.
- **HU-04 — Un solo editor de motion.** CA-05: `apps/video-manager` ya no existe en display-ads y ninguna
  referencia viva apunta a él.
