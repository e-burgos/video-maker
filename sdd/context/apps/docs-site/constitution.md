# Constitución — apps/docs-site

> Versión 1.0 | Última actualización: cycle-0 (inicial, abierto por spec-e-burgos-017-desktop-app cycle-06)

## 1. Propósito

- **Tipo:** sitio estático (GitHub Pages)
- **Rol en el sistema:** web de documentación y descarga de la app de escritorio para los amigos del dev:
  requisitos, instalación (incluida la apertura sin firma), primer arranque, cómo conectar Claude u OpenRouter,
  uso del estudio, preguntas frecuentes y licencias.

## 2. Stack tecnológico

- HTML y CSS estáticos generados en el build, sin frameworks de cliente ni CDNs externos.

## 3. Estructura y patrones

- `src/` contenido en español; `public/` capturas reales de la app; `deploy/` el workflow de Pages para el repo
  público; `scripts/` publicación manual.

## 4. Convenciones propias

- El botón de descarga apunta siempre a `releases/latest/download/<nombre estable>.dmg` del repo público.
- Nada del sitio depende del repo privado: se publica en el repo de distribución.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
