# Producciones reales de display ads desde la app 0.2.0 — cycle-04 TASK-009

> 2026-09-25. App instalada (build 0.2.0 del dry-run, reconstruida con cada arreglo) apuntada a `media/` del repo.
> Motor Claude CLI (Sonnet), un turno de pedido + uno de confirmación por video, manejado por CDP escribiendo en el
> chat. Material de la referencia `display-ads-creacion-campana-full-desktop`: `logo-largo.png` y `music01.mp3`
> (Rafael Krux, CC BY 4.0) con su crédito. Pedido: Receta Tutorial YouTube, voz Daniela sobre el guion con tiempos del
> proyecto, subtítulos clásicos, logo abajo a la derecha al 50 %, placas de 2 s de inicio y cierre.

## Resultado: 13/13 renderizados

| Proyecto | A-roll | Video | Líneas de voz | Palabras con tilde en subtítulos | Líneas aceleradas | Desborde máx. | Salida |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `display-ads-subir-medios` | 41.7 s | 45.7 s | 6 | 12 | 0 | 0 ms | `out/412219a6-726f-40ee-ae09-c47f368d8367.mp4` |
| `display-ads-reportes-campanas` | 45.7 s | 49.7 s | 7 | 15 | 0 | 0 ms | `out/58687aa7-3f70-4395-b5eb-4f9e9769d537.mp4` |
| `display-ads-subida-masiva` | 46.5 s | 50.5 s | 6 | 13 | 0 | 0 ms | `out/465a73ff-64bf-41e4-b9f7-b47d1264795f.mp4` |
| `display-ads-estados-campana` | 52.5 s | 56.5 s | 6 | 7 | 0 | 0 ms | `out/81a20f2b-6ea6-4173-b4da-e9c66c719565.mp4` |
| `display-ads-perfil-organizacion` | 56.0 s | 60.0 s | 6 | 12 | 0 | 0 ms | `out/8bde0c49-3f56-4cfa-8073-7790814c1813.mp4` |
| `display-ads-crear-ubicacion` | 68.2 s | 72.2 s | 7 | 12 | 0 | 0 ms | `out/38fc321a-940f-4b5e-8767-aeed3a2b0746.mp4` |
| `display-ads-operar-dispositivo` | 68.8 s | 72.8 s | 7 | 19 | 0 | 0 ms | `out/e9b3dfcd-3176-41c2-a1ed-94eeb4a17edd.mp4` |
| `display-ads-crear-rol` | 69.4 s | 73.4 s | 7 | 12 | 0 | 0 ms | `out/39f1c2bf-d8d1-4118-874f-005cf7a7b3ba.mp4` |
| `display-ads-analiticas` | 71.2 s | 75.2 s | 7 | 25 | 0 | 0 ms | `out/ce85d89b-6596-40b7-a7f3-ad92601c4b25.mp4` |
| `display-ads-editar-campana` | 63.8 s | 67.7 s | 8 | 14 | 1 | 194 ms | `out/6f4a3464-0d87-4c3f-923a-3722906c3aa1.mp4` |
| `display-ads-solapamiento-campanas` | 57.8 s | 61.7 s | 8 | 20 | 1 | 878 ms | `out/63a7b060-0b14-49d6-93d2-177e36601ebd.mp4` |
| `display-ads-linea-de-tiempo` | 55.0 s | 58.9 s | 9 | 12 | 1 | 155 ms | `out/ca44cc30-6dc6-46cc-99e9-7b8006f1cafc.mp4` |
| `display-ads-crear-grupo` | 59.0 s | 63.0 s | 6 | 12 | 0 | 0 ms | `out/b8459628-0007-4bf9-8297-03de2ff1f20c.mp4` |

Todos duran A-roll + 4 s (placas). Frames revisados por el orquestador (placa de inicio, tres momentos, placa de cierre):
narración sobre la acción que describe, logo en su esquina, placas con el logo.

## Defectos encontrados y arreglados en el camino

1. **Subtítulos sin tildes** (primera corrida de `crear-grupo`): el productor usó `put_timeline` (reemplazo total) para
   logo y placas y re-escribió los subtítulos sin acentos → TASK-007 (`patch_timeline` + guarda en `put_timeline`).
   Rehecho: 0 → 12 palabras con tilde.
2. **Pantallas viejas en el mensaje de entrega** ("Preview", "Generated", "Voice") → TASK-008.
3. **Voz que falla siempre que hay que acelerar una línea** (3 de 12 en la primera tanda: `editar-campana`,
   `solapamiento-campanas`, `linea-de-tiempo`): `--vits-length-scale` se pasaba en dos argumentos y sherpa-onnx solo
   acepta `--flag=valor` (defecto previo a esta spec) → TASK-010. Rehechos: los tres usan `lengthScale` 0.85–0.89.
4. **El productor no veía el error de un job** (`wait_for_job` rechazaba el error real con "forma desconocida" y el
   modelo lo llamó "transitorio") → TASK-010.

## Observaciones sin arreglar

- Subtítulo blanco con borde fino sobre la interfaz clara de Display Ads: legible pero con poco contraste (mismo estilo
  que la referencia).
- Loudness integrado ≈ −18 LUFS, igual que la referencia (−17,8): comportamiento actual del pipeline, no regresión.
