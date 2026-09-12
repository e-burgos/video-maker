# FIX-e-burgos-015-004 — El productor entrega sin decir dónde quedó cada cosa y elige un logo sin transparencia

| Campo         | Valor                             |
| ------------- | --------------------------------- |
| **ID**        | FIX-e-burgos-015-004              |
| **Tipo**      | IMPROVEMENT                       |
| **Severidad** | low                               |
| **Keyword**   | [IMPROVEMENT]                     |
| **Fecha**     | 2026-09-11                        |
| **Autor**     | e-burgos                          |
| **Estado**    | implemented                       |
| **Spec**      | spec-e-burgos-015-studio-producer |
| **Origen**    | Feedback del dev sobre `media/display-ads` (puntos 3 y 6). |

## Problema

El productor terminó el video y no dijo dónde verlo: el dev fue a la biblioteca y a Storyboard y no
encontró nada. Además eligió como logo el único PNG que había en `raw/logo/` sin mirar si tenía
transparencia, y el video salió con un recuadro blanco.

## Solución

`build-producer-system-prompt.ts` (sección de reglas de la app) y la skill `video-producer` (§4 y
§9) exigen:

- **Al entregar**, nombrar el lugar de cada artefacto: el video en la pantalla `preview` y en la
  sección "Generated" de la biblioteca, la voz en la pantalla `voice`, el guion en la pantalla
  `storyboard`.
- **Al elegir logo**, cuando `raw/logo/` tiene más de un archivo, preferir el que tiene
  transparencia (`ffprobe -show_streams` → `pix_fmt` con `a`, o `pal8`) y preguntar sólo si los dos
  la tienen. Nunca usar un PNG sin alfa sin avisarle al usuario que va a salir como un recuadro.

## Límite conocido de la heurística

`pix_fmt` dice si el archivo **declara** un canal alfa, no si el arte es transparente. Medido sobre
el proyecto real: los dos archivos de `media/display-ads/raw/logo/` informan `rgba`, y el que el
productor eligió (`DisplayAds Blanco.png`) tiene el plano alfa con mínimo 10 —o sea, sí tiene
píxeles transparentes en el margen—, pero el arte trae un **recuadro blanco opaco** pintado adentro.
Por eso sale como recuadro en el video y esta regla no lo hubiera evitado. Medirlo automáticamente
pide mirar el plano alfa (`alphaextract,signalstats`) y aun así un fondo opaco pintado en el arte es
indistinguible de un logo que quiere fondo: lo tiene que ver el humano en el preview.

## Justificación del bypass del SPEC GATE

Sólo texto de prompt y de skill: no toca contratos, endpoints ni entidades. Perfil `solo`, sin ciclo
abierto sobre spec-015.

## Archivos

Ver `affected_files` en `sdd/fixes.json`.

## Verificación

Ver `test_reference` en `sdd/fixes.json`.
