# Constitución — libs/motion-graphics

> Versión 1.0 | Última actualización: creación | Fecha: 2026-10-07
> Creada por el orquestador al abrir `cycle-02` de `spec-e-burgos-020-motion-mode`.

## 1. Propósito

- **Tipo:** lib Node TS (`type:util`)
- **Rol:** todo lo que hace falta para pasar de un storyboard de motion (o una plantilla a mano) a un proyecto de
  HyperFrames listo para renderizar: contrato `MotionStoryboard`, catálogo de escenas, kit de marca, grilla de
  golpes, escenas sobre la grilla, ducking, mejor toma de voz y armado de la plantilla. No ejecuta binarios: eso
  lo hacen sus consumidores (`tools/motion-studio`, `apps/render-api`) con sus puertos.

## 2. Stack

TypeScript estricto, `zod` 4 (contratos), Vitest 4. Runtime de navegador en `assets/runtime/` (GSAP 3.14 local).

## 3. Reglas

- La IA y las personas describen escenas; el markup y la animación los genera la lib. Nada de HTML en el storyboard.
- Animación declarativa por `data-anim`: el runtime nunca usa `tl.call` para cambiar estado.
- Un storyboard inválido se rechaza con el camino del campo antes de tocar disco.
- Colores, logos y música solo en `assets/brands/<marca>/`; el catálogo es neutral.
