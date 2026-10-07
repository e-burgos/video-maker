# Integración de `motion-editor` en el monorepo

Aplicá estos dos cambios en la raíz del repo (no están en la carpeta del app).

## 1. `package.json` de la raíz — scripts

Agregá estas líneas al bloque `"scripts"`, junto a las de los demás apps:

```json
    "motion-editor": "nx dev motion-editor",
    "build:motion-editor": "nx build motion-editor --configuration=production",
    "test:motion-editor": "nx test motion-editor",
    "lint:motion-editor": "nx lint motion-editor",
```

No hace falta tocar `dependencies` ni `devDependencies`: el app usa React,
Vite, Vitest y TypeScript que ya están en la raíz. **No tiene `package.json`
propio a propósito** — igual que `webapp`, `backoffice` y `docs`.

## 2. Nada más

- `pnpm-workspace.yaml` ya incluye `apps/*`.
- `nx.json` ya tiene el plugin `@nx/vite`, que infiere los targets
  `dev` / `build` / `preview` / `test` / `typecheck` desde `vite.config.mts`.
- El tag `type:app` de `project.json` lo suma automáticamente a
  `pnpm front` (`nx run-many -t dev -p tag:type:app`), `pnpm build:all`,
  `pnpm test:all` y `pnpm lint:all`.

## Verificación

```bash
pnpm install
nx show project motion-editor --web    # debe listar dev, build, preview, test, typecheck
nx typecheck motion-editor             # limpio
pnpm motion-editor                     # http://localhost:7315
```

## Puertos asignados

| App | dev | preview |
| --- | --- | --- |
| webapp | 7311 | 7321 |
| backoffice | 7312 | 7322 |
| docs | 7314 | 7324 |
| **motion-editor** | **7315** | **7325** |
