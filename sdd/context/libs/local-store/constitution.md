# Constitución — libs/local-store

> Versión 1.0 | Última actualización: cycle-0 (inicial, abierto por spec-e-burgos-017-desktop-app cycle-02)

## 1. Propósito

- **Tipo:** lib TypeScript (Node, módulo nativo)
- **Rol en el sistema:** base SQLite del estudio: apertura con WAL y claves foráneas, migraciones
  versionadas por `user_version`, schema Drizzle y repositorios de proyectos, organización,
  conversaciones del productor, jobs y configuración. La consume `apps/render-api`.

## 2. Stack tecnológico

- `better-sqlite3` (sincrónico, nativo), `drizzle-orm`, Zod para validar columnas JSON, Vitest.

## 3. Estructura y patrones

- `database/` abre la base y aplica migraciones escritas a mano (sin `drizzle-kit` en runtime).
- `schema/` es el schema Drizzle; un test asera que coincide con la base migrada.
- `repositories/` expone funciones por agregado; lo que toca más de una tabla va en una transacción.

## 4. Convenciones propias

- Nunca guardar medios binarios en la base: solo estado, metadatos y rutas relativas al proyecto.
- Toda columna JSON se valida al leer.
- La lib no importa `apps/*`.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
