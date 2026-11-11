# Créditos de la música

| Archivo | Tema | Autor | Licencia | Tipo de video | BPM | Origen |
| --- | --- | --- | --- | --- | --- | --- |
| `Voxel Revolution.mp3` | Voxel Revolution | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | product, vertical | 122 | https://incompetech.com/music/royalty-free/ |
| `Newer Wave.mp3` | Newer Wave | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | tutorial, product | 110 | https://incompetech.com/music/royalty-free/ |
| `Late Night Radio.mp3` | Late Night Radio | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | tutorial | 72 | https://incompetech.com/music/royalty-free/ |
| `Pleasant Porridge.mp3` | Pleasant Porridge | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | tutorial | 119 | https://incompetech.com/music/royalty-free/ |
| `Screen Saver.mp3` | Screen Saver | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | tutorial | 120 | https://incompetech.com/music/royalty-free/ |
| `Aerosol of my Love.mp3` | Aerosol of my Love | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | tutorial | 100 | https://incompetech.com/music/royalty-free/ |
| `Upbeat Lounge Background.mp3` | Upbeat Lounge Background | Soundrider/Dope (jamendo.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | tutorial | 120 | https://www.jamendo.com/track/1670563 |
| `Motionless Land (Instrumental).mp3` | Motionless Land (Instrumental) | Josh Woodward (jamendo.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | tutorial | 138 | https://www.jamendo.com/track/764950 |
| `Getting it Done.mp3` | Getting it Done | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | product | 135 | https://incompetech.com/music/royalty-free/ |
| `Werq.mp3` | Werq | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | product | 125 | https://incompetech.com/music/royalty-free/ |
| `Bleeping Demo.mp3` | Bleeping Demo | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | product | 74 | https://incompetech.com/music/royalty-free/ |
| `Loopster.mp3` | Loopster | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | product | 108 | https://incompetech.com/music/royalty-free/ |
| `Inspiring Technology.mp3` | Inspiring Technology | Soundrider/Dope (jamendo.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | product | 128 | https://www.jamendo.com/track/1670593 |
| `Cloud Dancer.mp3` | Cloud Dancer | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | vertical | 107 | https://incompetech.com/music/royalty-free/ |
| `Neon Laser Horizon.mp3` | Neon Laser Horizon | Kevin MacLeod (incompetech.com) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | vertical | 160 | https://incompetech.com/music/royalty-free/ |
| `The Corporate Upbeat.mp3` | The Corporate Upbeat | Soundrider/Dope (jamendo.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | vertical | 130 | https://www.jamendo.com/track/1670594 |
| `Inspiring Corporate.mp3` | Inspiring Corporate | Soundrider/Dope (jamendo.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | institutional | 80 | https://www.jamendo.com/track/1670484 |
| `Thanks for Coming (Instrumental).mp3` | Thanks for Coming (Instrumental) | Josh Woodward (jamendo.com) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | institutional | 80 | https://www.jamendo.com/track/628321 |

Voxel Revolution y Newer Wave se descargaron de incompetech.com el 2026-10-07; el resto, el
2026-11-10 (FIX-e-burgos-038), recomprimido a MP3 de 96 kbps. CC BY exige atribución: los videos de
storyboard no la dibujan; `render` deja `<video>.credits.txt` al lado del MP4 y ese texto va en la
descripción de la publicación (las plantillas a mano de spec-019 todavía la muestran con `{{music_credit}}`).
Los temas de la Biblioteca de audio de YouTube no están acá: su licencia permite usarlos en videos pero no
redistribuir los archivos, y este repo y el instalador son públicos. Viven fuera de git en
`brands/.local-music/<marca>/` (los MP3 más un `music.json` con las mismas entradas que `music` de
`brand.json`, sin el prefijo `music/`) y el studio los suma a la música de la marca solo en la máquina que
los tiene.

`videoTypes` en `brand.json` dice para qué videos sirve cada tema: `tutorial` (grabación de pantalla con voz
larga), `product` (producto y motion), `vertical` (Shorts y promos cortas) e `institutional` (marca y cierre).

Efectos de sonido (`assets/runtime/sfx/`): biblioteca incluida en las skills de HyperFrames (Apache 2.0).
Fuentes (`fonts/`): Outfit y Geist / Geist Mono, SIL Open Font License, vía Fontsource.
GSAP (`assets/runtime/gsap.min.js`): GSAP 3.14.2, licencia estándar gratuita de GSAP.
