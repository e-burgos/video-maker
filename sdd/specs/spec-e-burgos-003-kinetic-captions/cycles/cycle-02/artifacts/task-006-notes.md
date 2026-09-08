# TASK-006 — desvíos respecto del architect

## `CaptionPresetGalleryProps`: `type` en vez de `interface`

El architect (§9.1) declara `CaptionPresetGalleryProps` como `interface`. Al registrar
`<Composition component={CaptionPresetGallery} defaultProps={...} width={4320} height={1920}
fps={30} durationInFrames={265} />` **sin `calculateMetadata`** (tal como pide el architect: "las
dimensiones son fijas por diseño"), `tsc` falla:

```
TS2322: Type 'FC<CaptionPresetGalleryProps>' is not assignable to type
'LooseComponentType<Record<string, unknown>>'.
```

Causa: el genérico `Props extends Record<string, unknown>` de `Composition<Schema, Props>` (de
`remotion@4.0.522`) solo se infiere de forma confiable cuando hay un `calculateMetadata` presente
(como en `TimelineComposition`, que sí lo pasa) — es la única posición con una función concreta que
ancla el tipo. Sin `calculateMetadata`, ni `component` ni `defaultProps` alcanzan a fijar el
genérico y `Props` cae al default `Record<string, unknown>`, contra el que un `interface` con
propiedades requeridas no es asignable (un `interface` no trae índice de firma implícito; un
`type` con un objeto literal sí lo satisface estructuralmente a los efectos de este chequeo de
Remotion). `TimelineCompositionProps` ya está declarado como `type` — por eso nunca lo sufrió.

**Fix aplicado:** cambiar `export interface CaptionPresetGalleryProps { ... }` por
`export type CaptionPresetGalleryProps = { ... };` en
`libs/composition-remotion/src/components/caption-preset-gallery.tsx`. Mismos campos, mismo
shape, cero cambio de superficie pública — solo la forma de declaración. Probé antes explicitar
los genéricos (`<Composition<AnyZodObject, CaptionPresetGalleryProps> ...>`), que falla con un
error distinto (`Index signature for type 'string' is missing in type
'CaptionPresetGalleryProps'`) por el mismo motivo. El cambio a `type` es la solución mínima y
además alinea la convención con `TimelineCompositionProps`.

No hay ningún otro desvío en TASK-006: `caption-preset-gallery.tsx` y la tercera `<Composition>`
de `Root.tsx` siguen el resto del contrato de §9 literal (estructura de paneles, `PANEL_BACKGROUND`
`#111318`, dimensiones 4320×1920, reutilización de `buildExampleTimeline('reels-9x16')` +
`timelineToSequenceProps`, sin `calculateMetadata`, sin entrar al barrel).
