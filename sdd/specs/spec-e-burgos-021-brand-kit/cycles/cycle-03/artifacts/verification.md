# cycle-03 — verificación punta a punta

Con `pnpm studio` y la API real (2026-10-08):

1. Marca de prueba **Cafe Aroma** creada en cycle-02 (paleta marrón/ámbar, Playfair Display, logo provisorio, sin
   música ni fotos ni equipos).
2. `POST /projects {slug: cafe-aroma-demo, mode: motion, brand: cafe-aroma}` → 201 con `brand: cafe-aroma`.
3. `PUT /projects/cafe-aroma-demo/motion/brief` (guion de 4 oraciones, `music: auto`, sin imágenes) → 200.
4. Job `motion` fase `all`: storyboard por Claude CLI (56 213 / 11 887 tokens, USD 0,31, sin reparación), voz, plan,
   compose y render → `out/video.mp4` 1920×1080, 903 cuadros, 30,07 s, 7 escenas
   (hook, problem, brand-reveal, 3 × feature, cta), `music: null` porque la marca no tiene temas.
5. Cuadros revisados (`cafe-aroma-demo-sheet.jpg`): fondo, brillos, acentos y tipografía de la marca en todas las
   escenas. Defecto encontrado: sin isotipo la esquina repetía el nombre al lado del logo completo → `cornerBug`
   muestra sólo el logo; re-render fase `video` (voz reutilizada) confirmado.
6. Web: la barra del proyecto muestra la marca y en motion lleva al brief; el brief lista las marcas propias con
   "(propia)" y ofrece sólo "Sin música".
