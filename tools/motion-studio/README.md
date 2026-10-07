# motion-studio

Videos de motion graphics sobre [HyperFrames](https://github.com/heygen-com/hyperframes): plantillas
HTML + GSAP con la marca, voz Piper es_AR con la mejor toma, grilla de golpes de la música con cortes al
golpe opcionales y ducking de la música bajo la voz.

```bash
pnpm nx run motion-studio:cli -- init displayads/counter-15 media/motion/counter-15
pnpm nx run motion-studio:cli -- voice media/motion/counter-15 --takes 5
pnpm nx run motion-studio:cli -- plan media/motion/counter-15 [--no-beat-sync]
pnpm nx run motion-studio:cli -- compose media/motion/counter-15
pnpm nx run motion-studio:cli -- render media/motion/counter-15 --out media/motion/out/counter-15.mp4
```

Guía completa (plantillas, placeholders, reglas del render): skill `motion-studio` (`sdd/skills/motion-studio/SKILL.md`).

## Plantillas incluidas

| Plantilla | Duración | Música |
| --- | --- | --- |
| `displayads/presentacion` | ~87 s | "Voxel Revolution" (122 BPM) |
| `displayads/counter-15` | ~63 s | "Newer Wave" (110 BPM) |
| `displayads/core-pro` | ~75 s | "Newer Wave" (110 BPM) |

Música: Kevin MacLeod (incompetech.com), CC BY 4.0 — ver `templates/displayads/_music/CREDITS.md`.
