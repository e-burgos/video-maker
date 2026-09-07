# TASK-001 — notas del scaffold (para el reviewer y el fragmento de contexto)

- **Overlay de `nx.json` (D-02):** el generador `@nx/react:lib` volvió a registrar
  `@nx/eslint/plugin` (target inferido `eslint:lint`) y `@nx/vitest` (target inferido
  `vitest:test` en modo watch, más un bloque `generators.@nx/react.library`). Se revirtió
  `nx.json` a la versión de git (`git checkout -- nx.json`): queda con exactamente los tres
  plugins `@nx/js`, `@nx/react`, `@nx/vite`, igual que antes del scaffold. `project.json`
  declara `lint`/`test`/`build`/`studio` explícitos (D-02), sin target `smoke` (lo agrega
  TASK-007, según la tabla de asignación de §2 de `architect.md`).
- **Dependencias de dev que el generador agrega y no pide `architect.md`:** con
  `--linter=eslint` en una lib React, el generador de Nx instala `@babel/core`,
  `@babel/preset-react` (más un `.babelrc` con `@nx/react/babel`), y
  `eslint-plugin-import`/`eslint-plugin-jsx-a11y`/`eslint-plugin-react`/`eslint-plugin-react-hooks`
  (para `nx.configs['flat/react']`) y `@vitest/ui`. `eslint.config.mjs` de la lib sigue el
  patrón de `timeline-core`/`media-local` (extiende el raíz, sin `flat/react`) según D-07, así
  que ninguno de esos paquetes queda referenciado. Se removieron con `pnpm remove -w` y se
  borró `.babelrc` (el resto del repo usa `@vitejs/plugin-react` sin `.babelrc` propio, ver
  `apps/web/vite.config.ts`). `jsdom` y `@testing-library/react`/`@testing-library/dom` sí se
  mantienen (D-04), normalizados a `^` (el generador los había pinneado sin rango).
- **`buildExampleTimeline(preset)`** solo se ejercita en este ciclo con `'reels-9x16'`
  (`example-timeline.spec.ts`); el tipo del parámetro ya está acotado a
  `'reels-9x16' | 'youtube-16x9'` (D-11) para que TASK-006 no tenga que tocar la firma al sumar
  el caso 16:9.
- **Archivo no listado originalmente en `tasks.json`:** se agregó
  `src/__fixtures__/example-timeline.spec.ts` — el spec mínimo que exige la task ("test mínimo
  que verifique que `buildExampleTimeline('reels-9x16')` pasa `validateTimeline` y tiene
  `durationFrames` 265") y que además cumple D-08 (al menos un spec de TASK-001 que importa un
  **valor** de `timeline-core`, para que un alias de Vitest faltante falle en el scaffold y no
  cuatro tasks después — lección de `cycle-02`). El `resolve.alias` de `vite.config.ts` ya
  estaba declarado antes de correr este spec y la suite pasó a la primera.
- Verificado: `pnpm nx show projects` lista `composition-remotion`;
  `pnpm exec nx run-many -t lint test build` en verde para los 5 proyectos del workspace;
  `pnpm sdd:validate` en verde; sin `src/lib/*` ni `vitest.config.mts` ni otros placeholders
  del generador en `git status`; sin `package-lock.json`/`yarn.lock`.
