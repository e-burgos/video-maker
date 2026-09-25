# spec-e-burgos-018-producer-free-tier cycle-03 — 2026-09-25

## Qué pasó
Dos defectos que solo la corrida real mostró: el preview de fotos reusaba la extracción de frame (`-ss 0 -i foto.jpg`)
y ffmpeg salía 0 sin escribir nada; y la búsqueda combinada concatenaba Commons + NASA antes de recortar, así que
NASA nunca aparecía.

## Lección
Al combinar dos o más fuentes de resultados, intercalar antes de recortar a `maxResults`, y nunca pasar `-ss` a ffmpeg sobre una imagen fija (sale 0 sin archivo): verificar la salida de un comando de medios por el archivo escrito, no por el exit code.

## Costo evitable
Ninguno grande: la verificación real los atrapó antes del cierre.
