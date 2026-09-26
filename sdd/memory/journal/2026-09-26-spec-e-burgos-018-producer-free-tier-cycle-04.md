# spec-e-burgos-018-producer-free-tier cycle-04 — 2026-09-26

## Qué pasó
Producir 13 videos reales desde la app instalada destapó cuatro defectos que ningún test veía: subtítulos sin tildes
porque la tool de timeline obligaba al modelo a re-escribir el documento entero, la voz rota cada vez que había que
acelerar una línea (`--flag valor` en vez de `--flag=valor`), un schema de error copiado de otro concepto que escondía
el error real del job, y nombres de pantallas viejos en el prompt.

## Lección
Toda tool que un modelo usa para ajustar un documento grande tiene que aceptar cambios parciales (parche por sección): un reemplazo total lo obliga a re-escribir datos que no quería tocar y los corrompe en silencio; y una prueba de punta a punta desde la app empaquetada encuentra lo que los smokes por endpoint no ven.

## Costo evitable
Un reintento de 3 proyectos y uno de `crear-grupo` (~20 min de producción).
