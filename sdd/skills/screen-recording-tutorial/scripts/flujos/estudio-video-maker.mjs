import { abrirGrabacion, clic, clicPreciso, escribir, irA, aire, esperar, irARuta, cerrarYExportar, informeCierre } from '../lib-record.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SLUG = process.env.SLUG ?? 'video-maker-de-punta-a-punta';
const BASE_URL = process.env.STUDIO_URL ?? 'http://localhost:4407';
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4499';
const DESTINO = process.env.DESTINO;
const FASE = process.env.FASE ?? 'todo';
const MATERIAL = process.env.MATERIAL_DIR;
const MARCA = process.env.MARCA ?? 'Café Aroma';
const NOMBRE_VIDEO = process.env.NOMBRE_VIDEO ?? MARCA;
const PROYECTO = process.env.PROYECTO;

const FOTOS = ['barista-espresso.jpg', 'desayuno-cafe.jpg', 'tostadora.jpg', 'latte-art.jpg'];
const PEDIDO = 'Un video de 30 segundos para Instagram, vertical, con mi marca y estas fotos. Tono cálido.';

const NARRACION = [
  'Te muestro Video Maker en vivo: de una idea a un video terminado, con un productor de inteligencia artificial.',
  'Empezamos por la marca. En Marcas, tocá Nueva marca y poné el nombre: Café Aroma, para este ejemplo.',
  'Cargá el eslogan, subí el logo y elegí los colores. La vista previa cambia al instante.',
  'Elegí la voz de la marca y guardá. Con eso queda lista para usarla en cualquier video.',
  'Ahora un video nuevo: poné un nombre, elegí motion graphics y la marca que acabás de crear.',
  'Adjuntá tus fotos y confirmá el rol de cada una.',
  'Contale al productor qué querés. Él mira cada foto y te propone tres enfoques.',
  'Elegís uno y lo aprobás. El productor escribe el guion y arma el storyboard, escena por escena.',
  'Lo revisás, das el visto bueno, y el productor genera la voz, elige la música y renderiza.',
  'Mientras trabaja, podés recorrer el storyboard, la voz y la biblioteca de tu proyecto.',
  'Y este es el resultado: un video con tu marca, tu voz y tu música, listo para publicar.',
  'Desde acá lo publicás en YouTube: se suma a la cola, que sube los videos de a uno.',
  'En Configuración elegís el motor de inteligencia artificial, y la Guía te explica cada paso.',
  'Video Maker corre en tu Mac, como app de escritorio o en local desde el navegador. Descargalo desde la web.',
];
const FRASE_FINAL = 'Gracias por mirar este tutorial, nos vemos en el próximo.';

const sinTildes = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const TOPE_GLOBAL_MS = 40 * 60 * 1000;
setTimeout(() => { console.error('tope global de la toma superado: se aborta'); process.exit(3); }, TOPE_GLOBAL_MS).unref();
const palabras = (frase) => frase.trim().split(/\s+/).length;
const segundosDe = (frase) => palabras(frase) / 2.6 + 0.4;

const { browser, ctx, page, hito, hitos, sesion, base } = await abrirGrabacion({ slug: SLUG, baseUrl: BASE_URL });
let resultado = { ok: false, fase: FASE };
let inicioEscena = Date.now();
let slugVideo = PROYECTO;

const escena = (n, texto) => {
  hito(texto);
  inicioEscena = Date.now();
  escena.n = n;
};
const completarVentana = async () => {
  const falta = segundosDe(NARRACION[escena.n]) - (Date.now() - inicioEscena) / 1000;
  if (falta > 0) await aire(page, falta);
};

const enlace = (texto) => page.getByRole('link', { name: new RegExp(`^${texto}$`, 'i') }).or(page.getByRole('button', { name: new RegExp(`^${texto}$`, 'i') })).first();
const guardarSiHay = async (espera = 700) => {
  const g = page.getByRole('button', { name: /^guardar$/i }).first();
  if ((await g.count()) && (await g.isVisible()) && (await g.isEnabled())) await clic(page, g, espera);
};
const boton = (texto) => page.getByRole('button', { name: new RegExp(texto, 'i') }).first();
const reemplazar = async (loc, valor) => {
  await irA(page, loc);
  await loc.click({ timeout: 15000 });
  await page.keyboard.press('Meta+A');
  for (const ch of valor) { await page.keyboard.type(ch); await page.waitForTimeout(40); }
};
const pegarTexto = (valor) => page.evaluate((v) => {
  const t = document.querySelector('textarea');
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  set.call(t, v);
  t.dispatchEvent(new Event('input', { bubbles: true }));
}, valor);
const ocultarSecretos = () => page.evaluate(() => {
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length === 0 && /••••/.test(el.textContent ?? '')) el.textContent = 'Key cargada';
  }
});
const desplazarChat = (hacia) => page.evaluate((h) => {
  const caja = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible' && e.clientHeight > 200);
  if (caja) caja.scrollTo({ top: h === 'fin' ? caja.scrollHeight : 0, behavior: 'smooth' });
}, hacia);
const api = async (ruta) => (await fetch(`${API_URL}${ruta}`)).json();
const turnoTerminado = async () => {
  const d = await api(`/projects/${slugVideo}/producer`);
  return d.activeTurn === null && d.messages.some((m) => m.role === 'assistant');
};
const videoListo = async () => {
  const d = await api(`/projects/${slugVideo}`);
  return d.layout?.out === true && (await api(`/projects/${slugVideo}/producer`)).activeTurn === null;
};

async function marca() {
  escena(0, 'Pantalla principal');
  await irARuta(page, base, '/', 1200);
  await irA(page, boton('nuevo video'));
  await completarVentana();

  escena(1, 'Marcas: nueva marca');
  await clic(page, enlace('Marcas'), 500);
  await clic(page, boton('nueva marca'), 500);
  await escribir(page, page.getByLabel(/nombre de la marca/i), MARCA, 300);
  await clic(page, boton('crear marca'), 1500);
  await completarVentana();

  escena(2, 'Identidad, logo y colores');
  const hablado = page.getByLabel(/nombre hablado/i);
  if (!(await hablado.inputValue())) await escribir(page, hablado, MARCA, 200);
  await reemplazar(page.getByLabel(/eslogan/i), 'Tu lugar de siempre');
  await guardarSiHay(700);
  await clic(page, page.getByRole('button', { name: /^logo$/i }).first(), 500);
  await page.locator('input[type="file"]').first().setInputFiles(join(MATERIAL, 'cafe-aroma-logo.svg'));
  await aire(page, 1.2);
  await clic(page, page.getByRole('button', { name: /^colores$/i }).first(), 500);
  await reemplazar(page.getByLabel(/^fondo hex$/i), '#2a1a10');
  await reemplazar(page.getByLabel(/^acento hex$/i), '#c8874a');
  await reemplazar(page.getByLabel(/^acento 2 hex$/i), '#e8c9a0');
  await guardarSiHay(800);
  await completarVentana();

  escena(3, 'Voz de la marca');
  await clic(page, page.getByRole('button', { name: /^voz$/i }).first(), 600);
  const tarjetas = page.locator('[data-testid="voice-card"]');
  const daniela = tarjetas.filter({ hasText: /daniela/i }).first();
  await clic(page, (await daniela.count()) ? daniela : tarjetas.first(), 700);
  await guardarSiHay(800);
  await completarVentana();
}

async function videoNuevo() {
  escena(4, 'Nuevo video con la marca');
  await clic(page, enlace('Video Maker Studio'), 600);
  await clic(page, boton('nuevo video'), 500);
  await escribir(page, page.getByPlaceholder(/próximo reel/i), NOMBRE_VIDEO, 300);
  await clic(page, page.locator('label').filter({ hasText: /motion graphics/i }).first(), 500);
  if (!(await page.getByRole('radio', { name: /motion graphics/i }).isChecked())) throw new Error('el modo Motion graphics no quedó seleccionado');
  await clic(page, page.locator('label').filter({ hasText: new RegExp(MARCA, 'i') }).first(), 500);
  await clic(page, boton('crear video'), 1200);
  const tarjeta = page.locator('a[href^="/projects/"]').filter({ hasText: new RegExp(sinTildes(NOMBRE_VIDEO), 'i') }).first();
  await tarjeta.waitFor({ timeout: 15000 });
  slugVideo = (await tarjeta.getAttribute('href')).match(/\/projects\/([^/?#]+)/)[1];
  await clic(page, tarjeta, 1500);
  await clic(page, page.locator(`a[href="/projects/${slugVideo}"]`).first(), 1200);
  await completarVentana();
}

async function adjuntarYPedir() {
  escena(5, 'Adjuntar las fotos');
  const [selector] = await Promise.all([page.waitForEvent('filechooser'), clic(page, boton('adjuntar archivos'), 300)]);
  await selector.setFiles(FOTOS.map((f) => join(MATERIAL, f)));
  await page.getByRole('button', { name: /^confirmar$/i }).first().waitFor({ timeout: 30000 });
  while (await page.getByRole('button', { name: /^confirmar$/i }).count()) {
    await clic(page, page.getByRole('button', { name: /^confirmar$/i }).first(), 400);
    await page.waitForTimeout(600);
  }
  await completarVentana();

  escena(6, 'Pedirle el video al productor');
  await escribir(page, page.locator('textarea').first(), PEDIDO, 300);
  await clic(page, boton('^enviar$'), 600);
  if (FASE === 'A') return;
  await esperar(page, turnoTerminado, { salidaSeg: segundosDe(NARRACION[6]) });
  await desplazarChat('inicio');
}

async function aprobarYProducir() {
  escena(7, 'Aprobar el enfoque');
  const aprobar = page.locator('button').filter({ hasText: /^aprobar este enfoque$/i }).first();
  const apareceEnVivo = await aprobar.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (!apareceEnVivo) {
    console.error('· el botón de aprobar no apareció en vivo: se recarga la página');
    await page.reload({ waitUntil: 'networkidle' });
    await aprobar.waitFor({ timeout: 20000 });
  }
  await aprobar.scrollIntoViewIfNeeded();
  await aire(page, 0.8);
  await clicPreciso(page, aprobar, 900);
  const mensajesAntes = (await api(`/projects/${slugVideo}/producer`)).messages.length;
  await escribir(page, page.locator('textarea').first(), 'Dale, aprobé la 1.', 300);
  await clic(page, boton('^enviar$'), 800);
  await esperar(
    page,
    async () => {
      const d = await api(`/projects/${slugVideo}/producer`);
      return d.activeTurn === null && d.messages.length >= mensajesAntes + 2;
    },
    { salidaSeg: segundosDe(NARRACION[7]) },
  );
  await desplazarChat('fin');

  escena(8, 'Revisar el storyboard y dar el visto bueno');
  await escribir(page, page.locator('textarea').first(), 'Se ve bien, hacé el video.', 300);
  await clic(page, boton('^enviar$'), 800);
  await completarVentana();
}

async function recorrido() {
  escena(9, 'Recorrido por los módulos del proyecto');
  for (const destino of ['motion', 'storyboard', 'voice', 'library']) {
    await clic(page, page.locator(`a[href$="/projects/${slugVideo}/${destino}"]`).first(), 300);
    await aire(page, 1.2);
  }
  await completarVentana();
  await esperar(page, videoListo, { salidaSeg: 3 });
}

async function resultado_() {
  escena(10, 'El resultado');
  if (FASE === 'todo') await clic(page, page.locator(`a[href$="/projects/${slugVideo}/preview"]`).first(), 500);
  else await irARuta(page, base, `/projects/${slugVideo}/preview`, 800);
  await page.waitForFunction(() => { const v = document.querySelector('video'); return v !== null && v.readyState >= 3; }, null, { timeout: 90000 });
  const video = page.locator('video').first();
  await irA(page, video);
  await video.evaluate((el) => { el.muted = true; return el.play(); }).catch(() => {});
  await completarVentana();
  await aire(page, 3);

  escena(11, 'Publicar en YouTube');
  await irA(page, boton('publicar en youtube'));
  await aire(page, 1.2);
  await clic(page, enlace('Publicación'), 700);
  await completarVentana();

  escena(12, 'Configuración y guía');
  await clic(page, enlace('Configuración'), 900);
  await ocultarSecretos();
  await aire(page, 1.8);
  await clic(page, enlace('Guía'), 600);
  await page.getByText(/cómo se usa el studio/i).first().waitFor({ timeout: 30000 });
  await completarVentana();

  escena(13, 'Cierre');
  await clic(page, enlace('Video Maker Studio'), 900);
  await completarVentana();
}

try {
  if (FASE === 'M') await marca();
  if (FASE === 'todo' || FASE === 'A') {
    await marca();
    await videoNuevo();
    await adjuntarYPedir();
    if (FASE === 'A') {
      const turno = (await api(`/projects/${slugVideo}/producer`)).activeTurn;
      if (turno) await fetch(`${API_URL}/projects/${slugVideo}/producer/turns/${turno.turnId}`, { method: 'DELETE' });
    }
  }
  if (FASE === 'todo') {
    await aprobarYProducir();
    await recorrido();
    await resultado_();
  }
  if (FASE === 'C') {
    slugVideo = PROYECTO;
    await resultado_();
  }
  if (FASE === 'B') {
    slugVideo = PROYECTO;
    await irARuta(page, base, `/projects/${slugVideo}`, 1500);
    await recorrido();
    await resultado_();
  }
  resultado = { ok: true, fase: FASE, proyecto: slugVideo, escenas: hitos.length };
} catch (e) {
  resultado = { ok: false, fase: FASE, error: String(e).slice(0, 400) };
} finally {
  const salida = await cerrarYExportar({ ctx, page, browser, slug: SLUG, hitos, narracion: FASE === 'C' ? NARRACION.slice(10) : FASE === 'M' ? NARRACION.slice(0, 4) : NARRACION, sesion, resultado, destino: DESTINO, fraseDespedida: FRASE_FINAL, segDespedida: 3, despedida: FASE !== 'M' });
  console.log(JSON.stringify({ ...resultado, hitos, ficha: salida.ficha }, null, 2));
  if (salida.verificacion) console.log('\n' + informeCierre({ slug: SLUG, destino: salida.carpeta, formato: salida.formato, verificacion: salida.verificacion }));
}
