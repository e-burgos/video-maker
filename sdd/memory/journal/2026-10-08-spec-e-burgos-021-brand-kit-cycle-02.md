# spec-e-burgos-021-brand-kit cycle-02 — 2026-10-08

## Qué pasó
La vista previa de marca pasó 1 706 tests y el recorrido real encontró dos defectos que ningún test veía: dos
composiciones simultáneas sobre la misma carpeta (efecto doble de React) daban `INTERNAL_ERROR`, y el HTML de
HyperFrames servido fuera de su reproductor salía vacío (`html/body` sin alto, `#root` 100 % de 0). El test de
concurrencia con el storage falso pasaba igual con y sin el serializador: sólo el de disco real lo detectó.

## Lección
Probar toda escritura concurrente sobre el disco real (el storage falso no intercala I/O) y, al servir una composición
HyperFrames fuera de su reproductor, fijar el lienzo a `data-width`×`data-height` y escalarlo: sin eso sale vacía sin error.

## Costo evitable
Dos reinicios del studio y un ciclo de diagnóstico en el navegador.
