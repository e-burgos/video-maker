# spec-e-burgos-010-scene-assembly cycle-01 — 2026-09-10

## Estado
La composición renderiza la pista `scenes` además del A-roll. Cuatro escenas nativas —`TitleScene`,
`TextScene`, `CodeScene`, `ImageKenBurnsScene`— más `PlaceholderScene`, la tarjeta que muestra el
`visualPrompt` de una escena sin material para que el render nunca falle por un hueco vacío.
Funcionan en 9:16 y 16:9 con la paleta y la tipografía de los presets de captions de spec-003.

## Estructura
- `components/scene-track.tsx` — `SceneTrack` monta una `Sequence` por escena y despacha por
  `visual.kind`. Un asset de video más corto que su escena se repite con `<Loop>` (`sceneLoopFrames`);
  una imagen entra por `ImageKenBurnsScene` con el movimiento por defecto.
- `components/scenes/` — las cuatro escenas más el placeholder y `SceneFrame`, el marco común.
  Las escenas estáticas **no usan `useVideoConfig`**: reciben el `OutputFormat` por prop, así se
  testean con `@testing-library/react` sin contexto de Remotion.
- `helpers/scene-theme.ts` — paleta y tipografía derivadas del preset de captions. `paddingBottom`
  **reserva la banda de las captions**: se deriva de `captionBoxFor` del preset por defecto
  (`captionBandTop`), no de un ratio fijo, porque la banda depende del safe zone de cada formato.
  Sin esa reserva el texto de la escena y la caption se pisan e ilegibilizan el render.
- `helpers/ken-burns.ts` — `kenBurnsTransform`/`kenBurnsCss`, interpolación lineal determinista.
- `helpers/code-lines.ts` — `codeLayout` **primero achica el font y después recorta**: recortar
  contra el presupuesto base descarta texto que ya entraba al tamaño reducido. `columnsThatFit`
  deriva el presupuesto de columnas del ancho real de la tarjeta, no de una constante.
- `helpers/timeline-to-sequence-props.ts` — `plan.scenes` con el visual ya resuelto; un asset
  ausente degrada a placeholder y se reporta en `unresolvedAssetIds`.

## Dependencias
Ninguna nueva. Los componentes de escena no entran en `coverage.include` (igual que el resto de
`components/`); sus helpers puros sí, y tienen tests de render estático propios.

## Qué sigue
- El `columnGap` de las captions lo come el `scale` de la palabra enfatizada: dos palabras
  aparecen pegadas en el render. Es de spec-003, preexistente a este ciclo.
- Un snippet de código muy largo puede seguir bajando hasta la banda de captions. El arreglo real
  es el estilo de captions por escena (incluido `off`) que trae spec-012.
