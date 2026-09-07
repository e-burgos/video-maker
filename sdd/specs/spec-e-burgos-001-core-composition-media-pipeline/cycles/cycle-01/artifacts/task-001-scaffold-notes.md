# TASK-001 — notas del scaffold (para el reviewer y el fragmento de contexto)

- **TASK-001:** en Nx 23.1.1 / Vitest 4, `@nx/js:lib --unitTestRunner=vitest` ya no infiere el
  target `test` vía `@nx/vite` (como asumía architect.md D-04): registra un plugin nuevo,
  `@nx/vitest`, en `nx.json` (`testTargetName: "test"`), que sigue resolviendo a `pnpm nx test
  timeline-core` tal como pedía el contrato — sin cambio de comportamiento observable. El
  generador también registró `@nx/eslint/plugin` (target inferido `eslint:lint`); se agregó un
  target `lint` explícito en `project.json` (`@nx/eslint:lint`, igual que `shared-utils`) para no
  romper la convención `pnpm nx lint <proyecto>` del repo.
- Al ser la primera lib con Vitest del repo, el generador también creó (una sola vez, afecta al
  workspace, no a otras libs existentes): `vitest.config.ts` raíz (workspace runner de proyectos
  Vitest), `.prettierrc`/`.prettierignore`, y agregó `@nx/vitest` a `devDependencies` del
  `package.json` raíz. Ninguno de estos archivos requiere mantenimiento por lib.
- `libs/timeline-core` **no tiene target `build`** (decisión D-02: `--bundler=none`, se consume
  por source vía `paths`). El criterio de done de TASK-011 en este mismo `planner.md` menciona
  `pnpm nx build timeline-core`, que no aplicará — ajustarlo a `lint`/`test` al llegar a esa task.

- **Ajuste del orquestador tras TASK-001:** se quitaron de `nx.json` los plugins `@nx/vitest` (inferia `test` = `vitest` en modo watch, que cuelga `nx run-many -t test` fuera de CI) y `@nx/eslint/plugin` (target `eslint:lint` duplicado). `libs/timeline-core/project.json` declara `test` explícito (`vitest run --coverage --passWithNoTests`, igual que `apps/web`) y un target `build` = `tsc -p tsconfig.lib.json`: Vitest no hace typecheck, y el comando de verificación del repo es `lint test build`. D-02 de architect.md queda matizado: sin bundler, pero con typecheck/emisión de declaraciones en `build`.
