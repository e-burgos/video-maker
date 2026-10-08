# SPEC-e-burgos-021: Biblioteca de marcas — crear marcas y usarlas en motion graphics y en material crudo

> Estado: **completed** — registrada y cerrada el 2026-10-08 (cuatro ciclos). Continúa `spec-e-burgos-020-motion-mode`.
> Pedido del dev: un creador de marcas que tome DisplayAds como referencia, para definir cualquier marca y
> elegirla al generar un video de motion graphics o un video de material crudo.

## Situación actual

Una marca es una carpeta `libs/motion-graphics/assets/brands/<id>/` escrita a mano: `brand.json` (nombre,
nombre hablado, tagline, web, logo e isotipo, fuentes, voz, música, fotos con descripción, equipos con el
polígono de su pantalla) y `brand.css` (37 variables `--mg-*`). Tres límites:

1. Vive dentro del código: en la app instalada está dentro del `.app`, de sólo lectura.
2. Los colores son 37 variables CSS escritas a mano.
3. El modo material crudo no conoce marcas: logo por proyecto (`raw/logo`), color de la placa a mano,
   subtítulos con 4 estilos fijos (Inter, blanco), voz y música proyecto por proyecto.

## Objetivos

| # | Objetivo | Ciclo |
| --- | --- | --- |
| O-1 | Biblioteca de marcas del estudio: marcas del usuario en una carpeta escribible junto a los proyectos, marcas incluidas (DisplayAds) de sólo lectura y duplicables, API para crear, editar, duplicar y borrar, y paleta de 4 colores base de la que se derivan las variables | cycle-01 |
| O-2 | Página **Marcas** con el creador por secciones (identidad, logo, colores, tipografías, voz y música, fotos, productos) y vista previa en vivo de la apertura y el cierre | cycle-02 |
| O-3 | Motion graphics con cualquier marca: brief, storyboard automático, productor y app de escritorio usan las marcas del usuario | cycle-03 |
| O-4 | Material crudo con marca: el proyecto elige marca y de ahí salen logo de la marca de agua y de las placas, color de placa, estilo de subtítulos "de la marca", voz por defecto y el contexto del productor (tagline, web) | cycle-04 |

Fuera de alcance: borrador de marca por IA desde la web o el logo del cliente (posible spec siguiente).

## Decisiones de la spec

| # | Decisión | Por qué |
| --- | --- | --- |
| D-01 | El formato sigue siendo `brand.json` (+ assets) y se extiende con `palette` (fondo, acento, acento 2, texto) y `tokens` (variables retocadas); `css` pasa a opcional: si está, manda (marcas incluidas); si no, el CSS se genera de `palette` + `tokens` | El runtime y las escenas no cambian; DisplayAds sigue idéntica |
| D-02 | Las marcas del usuario viven en `brands/` al lado de la carpeta de proyectos (`dirname(projectsFolder)/brands`, configurable con `BRANDS_ROOT`); nunca dentro de la carpeta de proyectos (cada carpeta ahí se importa como proyecto) | Viajan con los proyectos y se pueden copiar o versionar; la app instalada puede escribirlas |
| D-03 | Los ids son únicos entre incluidas y del usuario; una incluida no se edita: se duplica | Sin sombras ambiguas; DisplayAds queda como referencia estable |
| D-04 | Duplicar copia los assets y fija como `tokens` todas las variables de la original | La copia se ve igual que la original desde el primer render |
| D-05 | Las tipografías se eligen de Google Fonts y se descargan una vez a la marca (woff2), o se suben | El render es offline; la red sólo hace falta al crear |
| D-06 | Ciclos `lite` (perfil solo del repo, decisión del dev); cada ciclo deja verde `nx run-many -t lint test build` de lo que toca y se prueba con `pnpm studio` y con la app instalada | Misma forma que spec-017/020 |
