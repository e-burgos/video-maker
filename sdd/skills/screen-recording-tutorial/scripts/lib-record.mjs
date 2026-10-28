// Librería base para grabar la UI real de una app con Playwright y dejar el material crudo que consume
// Video Maker (contrato `video-maker-material-contract` §1–§11): un A-roll mudo 1080p@30 + el guion cronometrado
// `[m:ss]` + los hitos con los que se escribió. Cae directo en media/<slug>/ de este repo.
//
// Resuelve de una vez lo que hace fallar una grabación a ciegas: el cursor visible, el movimiento humano del
// mouse, el tipeo con ritmo, el login FUERA de cámara (el A-roll arranca ya adentro) y el cronómetro de hitos.
//
// Las credenciales nunca se escriben acá: salen del entorno o del .env de quien graba, y no se imprimen.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, renameSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const ROOT = process.env.VIDEO_MAKER_DIR ?? join(AQUI, '..', '..', '..', '..');
export const MEDIA = join(ROOT, 'media');

const require = createRequire(join(ROOT, 'package.json'));
export const { chromium } = require('@playwright/test');

const leerDotEnv = () => {
  const ruta = join(ROOT, '.env');
  if (!existsSync(ruta)) return {};
  return Object.fromEntries(
    readFileSync(ruta, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2')]),
  );
};
export const env = { ...leerDotEnv(), ...process.env };
const FFMPEG = env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = env.FFPROBE_PATH || 'ffprobe';

export const FORMATOS = {
  'youtube-16x9': { viewport: { width: 1600, height: 900 }, escala: 1, salida: { width: 1920, height: 1080 }, plataforma: 'YouTube / web / centro de ayuda' },
  'reels-9x16': { viewport: { width: 540, height: 960 }, escala: 2, salida: { width: 1080, height: 1920 }, plataforma: 'Instagram Reels' },
  'tiktok-9x16': { viewport: { width: 540, height: 960 }, escala: 2, salida: { width: 1080, height: 1920 }, plataforma: 'TikTok' },
  'shorts-9x16': { viewport: { width: 540, height: 960 }, escala: 2, salida: { width: 1080, height: 1920 }, plataforma: 'YouTube Shorts' },
};

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const carpetaDeVideo = (slug) => join(MEDIA, slug);

// Cursor sintético: Playwright mueve el mouse de verdad pero no lo dibuja, y sin cursor un
// tutorial no se entiende. Se reinyecta cada 1,5 s porque las navegaciones SPA lo pierden.
const CURSOR = `(() => {
  const add = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div');
    c.id = '__cur';
    c.style.cssText = 'position:fixed;left:-100px;top:-100px;z-index:2147483647;width:18px;height:18px;'
      + 'border-radius:50%;background:rgba(14,165,233,.35);border:2px solid #0ea5e9;pointer-events:none;'
      + 'transform:translate(-50%,-50%);box-shadow:0 0 0 5px rgba(14,165,233,.12);transition:width .08s,height .08s';
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.width = '30px'; c.style.height = '30px'; }, true);
    addEventListener('mouseup', () => { c.style.width = '18px'; c.style.height = '18px'; }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  setInterval(add, 1500);
})()`;

// Ritmo global: multiplica TODAS las pausas de lectura (flujos y helpers) sin tocar el movimiento
// del cursor ni el tipeo, que ya son humanos. 1 = pausas nominales; 0.5 = tutorial ágil.
let ritmo = Number(process.env.RITMO || 1);
export const setRitmo = (factor) => { ritmo = Number(factor) || 1; return ritmo; };
export const pausa = (page, ms) => page.waitForTimeout(Math.round(ms * ritmo));

export const FRASE_DESPEDIDA = 'Y eso es todo. Gracias por mirar este tutorial, nos vemos en el próximo.';
const SEG_DESPEDIDA = 6.5;
const INICIOS = new WeakMap();
const GANCHOS = new WeakMap();
const ESPERAS = new WeakMap();

/**
 * Aire para que entre una frase de la narración: a diferencia de `pausa`, NO lo escala el ritmo.
 * Se expresa en SEGUNDOS porque así se calcula (palabras / 2,5). Bajar el ritmo acelera la
 * navegación, no la locución: mezclarlos dejaba ventanas de 3 s para frases de 7 (2026-09-21).
 */
export const aire = (page, segundos) => page.waitForTimeout(Math.round(segundos * 1000));
export const mmss = (seg) => `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, '0')}`;

/**
 * Abre el navegador grabando, con el cursor dibujado y (si hay `iniciarSesion`) ya logueado.
 *
 * El login corre en un contexto SIN grabar y la sesión (storageState + sessionStorage) se traslada al contexto
 * grabado, así el A-roll arranca adentro y ninguna credencial queda en el video. `iniciarSesion(page, base)` es
 * un callback de la app grabada: escribe las credenciales (de env) y espera a estar adentro.
 * `alNavegar(page)` corre tras cada `irARuta` (descartar un tour, un banner de cookies, etc.).
 * `apiUrl` hace que `apiJson` guarde las respuestas JSON de esa API, para VERIFICAR el efecto real del flujo.
 */
export async function abrirGrabacion({
  slug,
  baseUrl,
  apiUrl,
  formato = 'youtube-16x9',
  iniciarSesion,
  alNavegar,
  inicio = '/',
  salida,
  ancho,
  alto,
  locale = 'es-AR',
  timezoneId = 'America/Argentina/Buenos_Aires',
} = {}) {
  if (!slug || !SLUG_RE.test(slug)) throw new Error(`slug inválido "${slug}": minúsculas, números y guiones (carpeta en media/)`);
  if (!baseUrl) throw new Error('falta baseUrl: la URL de la app que se graba');
  const fmt = FORMATOS[formato];
  if (!fmt) throw new Error(`formato desconocido: ${formato} (${Object.keys(FORMATOS).join(', ')})`);
  const dir = salida ?? join(ROOT, 'scratch', 'video-out', slug);
  mkdirSync(dir, { recursive: true });
  const viewport = { width: ancho ?? fmt.viewport.width, height: alto ?? fmt.viewport.height };
  const escala = fmt.escala ?? 1;
  const browser = await chromium.launch({
    headless: true,
    executablePath: env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: escala > 1 ? [`--force-device-scale-factor=${escala}`] : [],
  });
  const opcionesCtx = { viewport, deviceScaleFactor: escala, locale, timezoneId };

  let storageState;
  let sesionStorage = {};
  if (iniciarSesion) {
    const ctxLogin = await browser.newContext({ ...opcionesCtx, viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const pageLogin = await ctxLogin.newPage();
    await iniciarSesion(pageLogin, baseUrl);
    sesionStorage = await pageLogin.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
    storageState = await ctxLogin.storageState();
    await ctxLogin.close();
  }

  const tamanioVideo = { width: viewport.width * escala, height: viewport.height * escala };
  const ctx = await browser.newContext({ ...opcionesCtx, storageState, recordVideo: { dir, size: tamanioVideo } });
  await ctx.addInitScript(({ origen, datos }) => {
    if (location.origin !== origen || sessionStorage.length) return;
    for (const [k, v] of Object.entries(datos)) sessionStorage.setItem(k, v);
  }, { origen: new URL(baseUrl).origin, datos: sesionStorage });
  await ctx.addInitScript(CURSOR);

  const hitos = [];
  const t0 = Date.now();
  const page = await ctx.newPage();
  INICIOS.set(page, t0);
  GANCHOS.set(page, alNavegar);
  const hito = (texto) => {
    const t = (Date.now() - t0) / 1000;
    hitos.push({ t: Math.round(t * 10) / 10, texto });
    console.error(`· [${mmss(t)}] ${texto}`);
  };

  const apiJson = [];
  if (apiUrl) {
    page.on('response', async (r) => {
      if (!r.url().startsWith(apiUrl) || r.status() >= 300) return;
      try {
        if ((r.headers()['content-type'] || '').includes('json')) {
          apiJson.push({ metodo: r.request().method(), url: r.url().slice(apiUrl.length), body: await r.json() });
        }
      } catch {}
    });
  }

  await page.goto(`${baseUrl}${inicio}`, { waitUntil: 'networkidle', timeout: 40000 });
  await pausa(page, 1500);
  await alNavegar?.(page);

  const sesion = { base: baseUrl, formato };
  console.error(`· sesión: ${baseUrl} · formato ${formato}`);
  return { browser, ctx, page, apiJson, hito, hitos, sesion, base: baseUrl, dir };
}

// ─── Cursor con movimiento humano ─────────────────────────────────────────────────────────
// Un humano no mueve el mouse en línea recta a velocidad constante ni se detiene seco sobre el
// botón: acelera, describe una curva, frena al llegar, a veces se pasa un poco y corrige, y
// espera un instante antes de hacer clic. Todo lo de abajo imita eso. Vigente desde el
// 2026-09-20 para los tutoriales que se graben después de los dos "campana-full".
const mouseEstado = { x: 200, y: 200 };
const azar = (a, b) => a + Math.random() * (b - a);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Mueve el cursor de la posición actual a (x, y) por una curva Bézier con aceleración y frenado.
 *
 * El recorrido dura lo que dice `duracion` medido por RELOJ, no por la suma de pausas fijas: cada
 * `mouse.move` paga su ida y vuelta al navegador (5-10 ms), así que un bucle de pasos con
 * `waitForTimeout` fijo tardaba un 30-60 % más de lo previsto — 990 ms medidos contra 750 de
 * objetivo (2026-09-21). Se emite una posición cada ~12 ms como mucho: a 30 fps son más de dos
 * por cuadro, de sobra para que se vea fluido sin gastar tiempo en posiciones que nadie ve.
 *
 * Velocidad: la de una mano que sabe adónde va (230 ms para un tramo corto, 420 ms para cruzar la
 * pantalla). En los tramos largos hay a veces un sobrepaso con corrección.
 */
export async function moverMouse(page, x, y) {
  const x0 = mouseEstado.x;
  const y0 = mouseEstado.y;
  const dist = Math.hypot(x - x0, y - y0);
  if (dist < 2) return;
  const duracion = Math.min(420, 110 + Math.sqrt(dist) * 12) * azar(0.9, 1.1);
  // Puntos de control desviados hacia un costado: la curva se nota sin ser exagerada.
  const desvio = Math.min(90, dist * 0.18) * (Math.random() < 0.5 ? -1 : 1);
  const nx = -(y - y0) / dist;
  const ny = (x - x0) / dist;
  const c1 = { x: x0 + (x - x0) * 0.3 + nx * desvio, y: y0 + (y - y0) * 0.3 + ny * desvio };
  const c2 = { x: x0 + (x - x0) * 0.7 + nx * desvio * 0.5, y: y0 + (y - y0) * 0.7 + ny * desvio * 0.5 };
  const inicio = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - inicio) / duracion);
    const e = easeInOut(t);
    const u = 1 - e;
    const px = u * u * u * x0 + 3 * u * u * e * c1.x + 3 * u * e * e * c2.x + e * e * e * x;
    const py = u * u * u * y0 + 3 * u * u * e * c1.y + 3 * u * e * e * c2.y + e * e * e * y;
    const antes = Date.now();
    await page.mouse.move(t < 1 ? px + azar(-0.6, 0.6) : x, t < 1 ? py + azar(-0.6, 0.6) : y);
    if (t >= 1) break;
    const gasto = Date.now() - antes;
    if (gasto < 12) await page.waitForTimeout(12 - gasto);
  }
  if (dist > 400 && Math.random() < 0.3) {
    // Sobrepaso y corrección: unos píxeles de más en la dirección del movimiento y vuelta.
    await page.mouse.move(x + ((x - x0) / dist) * azar(4, 8), y + ((y - y0) / dist) * azar(4, 8));
    await page.waitForTimeout(azar(30, 55));
    await page.mouse.move(x, y);
  }
  mouseEstado.x = x;
  mouseEstado.y = y;
}

export async function irA(page, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const caja = await loc.boundingBox().catch(() => null);
  if (!caja) return null;
  // Intersección con el viewport: un elemento MÁS ANCHO que la pantalla (una barra de la línea de
  // tiempo con scroll horizontal) tiene su centro fuera de cámara, y un clic sintético en esa
  // coordenada aterriza en OTRO elemento — pasó el 2026-09-21 en el tutorial mobile: el último
  // plano abrió el detalle de la campaña equivocada. Se apunta siempre dentro de la parte visible;
  // si no hay nada visible se devuelve null y el llamador usa el click de Playwright.
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  const x0 = Math.max(0, caja.x);
  const x1 = Math.min(vp.width, caja.x + caja.width);
  const y0 = Math.max(0, caja.y);
  const y1 = Math.min(vp.height, caja.y + caja.height);
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const x = x0 + (x1 - x0) * azar(0.38, 0.62);
  const y = y0 + (y1 - y0) * azar(0.38, 0.62);
  await moverMouse(page, x, y);
  await pausa(page, azar(35, 80));
  return { x, y };
}

/** Clic humano: llegar, dudar un instante, clic, y la espera de lectura pedida por el flujo. */
export async function clic(page, loc, espera = 900) {
  const p = await irA(page, loc);
  if (p) await page.mouse.down(); else await loc.click({ timeout: 20000 });
  if (p) { await page.waitForTimeout(azar(35, 75)); await page.mouse.up(); }
  await pausa(page, espera);
}

/**
 * Clic GARANTIZADO sobre el elemento correcto: mueve el cursor como una mano (para el video) y
 * después delega el clic real en Playwright, que hace scroll —también horizontal—, espera que el
 * elemento esté estable y verifica que el evento lo reciba ESE elemento y no otro.
 * Úsalo cuando el blanco puede quedar fuera de cámara o vive en un contenedor con scroll: una
 * barra de la línea de tiempo es más ancha que un teléfono y un clic por coordenadas aterriza en
 * la barra de al lado (2026-09-21, el último plano del tutorial mobile abrió otra campaña).
 */
export async function clicPreciso(page, loc, espera = 900) {
  await irA(page, loc).catch(() => null);
  await loc.click({ timeout: 20000 });
  const caja = await loc.boundingBox().catch(() => null);
  if (caja) {
    const vp = page.viewportSize() ?? { width: 1280, height: 720 };
    mouseEstado.x = Math.min(vp.width - 1, Math.max(0, caja.x + caja.width / 2));
    mouseEstado.y = Math.min(vp.height - 1, Math.max(0, caja.y + caja.height / 2));
  }
  await pausa(page, espera);
}

/**
 * Escribe como una persona: ritmo irregular (más rápido en letras seguidas, pausas breves
 * en espacios y signos). Nunca `fill()`: el llenado instantáneo no se lee en video.
 */
export async function escribir(page, loc, texto, espera = 700) {
  await irA(page, loc);
  await loc.click({ timeout: 15000 }).catch(() => {});
  await pausa(page, azar(150, 300));
  for (const ch of texto) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(/[\s.,;:—-]/.test(ch) ? azar(90, 190) : azar(35, 95));
  }
  await pausa(page, espera);
}

/** Navega a una ruta de la app grabada y corre el gancho `alNavegar` (tour, banners) del flujo. */
export async function irARuta(page, base, ruta, espera = 2500) {
  await page.goto(`${base}${ruta}`, { waitUntil: 'networkidle', timeout: 30000 });
  await pausa(page, espera);
  await GANCHOS.get(page)?.(page);
}

export const dialogo = (page) => page.locator('[role="dialog"]').last();


/**
 * Espera una condición lenta (el productor pensando, un render) SIN dejar ese tiempo muerto en el video:
 * lo que dure se acelera al exportar para que ocupe `salidaSeg` segundos de A-roll, y los hitos posteriores se
 * reubican. Elegí `salidaSeg` = lo que dura la frase que se narra encima (palabras / 2,6 + ~0,5).
 * `condicion` es una función async que devuelve true cuando terminó la espera.
 */
export async function esperar(page, condicion, { salidaSeg = 8, tope = 1_200_000, cada = 3000 } = {}) {
  const inicio = INICIOS.get(page);
  const desde = (Date.now() - inicio) / 1000;
  const limite = Date.now() + tope;
  let cumplida = false;
  while (Date.now() < limite) {
    if (await condicion()) { cumplida = true; break; }
    await page.waitForTimeout(cada);
  }
  const hasta = (Date.now() - inicio) / 1000;
  const lista = ESPERAS.get(page) ?? [];
  lista.push({ desde, hasta, salida: Math.min(salidaSeg, hasta - desde) });
  ESPERAS.set(page, lista);
  if (!cumplida) throw new Error(`la espera superó el tope de ${Math.round(tope / 1000)} s`);
  return Math.round(hasta - desde);
}

/** Tiempo del A-roll final para un instante t de la grabación cruda, dadas las esperas aceleradas. */
function tiempoFinal(t, recorte, esperas) {
  let corrido = recorte;
  for (const e of esperas) {
    const largo = e.hasta - e.desde;
    if (t >= e.hasta) corrido += largo - e.salida;
    else if (t > e.desde) corrido += (t - e.desde) * (1 - e.salida / largo);
  }
  return Math.round((t - corrido) * 10) / 10;
}

function filtroConEsperas(recorte, esperas, ancho, alto) {
  const trozos = [];
  let cursor = recorte;
  const normal = (a, b) => `trim=start=${a.toFixed(3)}${b === null ? '' : `:end=${b.toFixed(3)}`},setpts=PTS-STARTPTS`;
  for (const e of esperas) {
    if (e.desde > cursor + 0.05) trozos.push(normal(cursor, e.desde));
    trozos.push(`trim=start=${e.desde.toFixed(3)}:end=${e.hasta.toFixed(3)},setpts=(PTS-STARTPTS)*${(e.salida / (e.hasta - e.desde)).toFixed(5)}`);
    cursor = e.hasta;
  }
  trozos.push(normal(cursor, null));
  const partes = trozos.map((f, i) => `[0:v]${f}[t${i}]`).join(';');
  const unidas = trozos.map((_, i) => `[t${i}]`).join('');
  return `${partes};${unidas}concat=n=${trozos.length}:v=1:a=0,scale=${ancho}:${alto}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${ancho}:${alto}:(ow-iw)/2:(oh-ih)/2,fps=30[v]`;
}

/**
 * Cierra la grabación y deja el material en media/<slug>/ con el layout de Video Maker:
 *   raw/aroll/<slug>.mp4        A-roll mudo, al tamaño del formato, 30 fps, H.264 yuv420p
 *   work/producer/script.txt    guion cronometrado [m:ss] (si se pasó `narracion`)
 *   work/producer/hitos.json    hitos con tiempo real, sesión, formato y resultado del flujo
 *
 * `narracion` es un array alineado 1:1 con los hitos: cada frase se coloca en el tiempo de su hito. Sin marcas de
 * tiempo Video Maker corta el video donde termina la voz — por eso acá siempre se escriben con marca.
 * El studio importa las carpetas de media/ al arrancar: un proyecto nuevo aparece tras reiniciarlo.
 */
export async function cerrarYExportar({ ctx, page, browser, slug, hitos = [], narracion, sesion, resultado, destino, entrada = 1.5, despedida = true, fraseDespedida = FRASE_DESPEDIDA, segDespedida = SEG_DESPEDIDA }) {
  if (despedida && narracion && narracion.length === hitos.length && INICIOS.has(page)) {
    hitos.push({ t: Math.round(((Date.now() - INICIOS.get(page)) / 1000) * 10) / 10, texto: 'despedida' });
    narracion = [...narracion, fraseDespedida];
    await page.waitForTimeout(segDespedida * 1000);
  }
  await pausa(page, 1200);
  const video = page.video();
  await ctx.close();
  const webm = await video?.path().catch(() => null);
  await browser.close();
  if (!webm || !existsSync(webm)) return { webm: null, aroll: null };

  const formato = sesion?.formato ?? 'youtube-16x9';
  const { width, height } = FORMATOS[formato].salida;
  const carpeta = destino ?? carpetaDeVideo(slug);
  const aroll = join(carpeta, 'raw', 'aroll', `${slug}.mp4`);
  const producer = join(carpeta, 'work', 'producer');
  mkdirSync(dirname(aroll), { recursive: true });
  mkdirSync(producer, { recursive: true });

  const recorte = hitos.length ? Math.max(0, hitos[0].t - entrada) : 0;
  const esperas = (ESPERAS.get(page) ?? []).filter((e) => e.hasta - e.desde > e.salida + 0.5).sort((a, z) => a.desde - z.desde);
  if (recorte > 0.2 || esperas.length) {
    for (const h of hitos) h.t = tiempoFinal(h.t, recorte > 0.2 ? recorte : 0, esperas);
  }

  const recorteReal = recorte > 0.2 ? recorte : 0;
  const filtroSimple = `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=30`;
  const argsVideo = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', aroll, '-y'];
  if (esperas.length) {
    execFileSync(FFMPEG, ['-v', 'error', '-i', webm, '-an', '-filter_complex', filtroConEsperas(recorteReal, esperas, width, height), '-map', '[v]', ...argsVideo]);
    console.error(`· ${esperas.length} espera(s) acelerada(s): ${esperas.map((e) => `${Math.round(e.hasta - e.desde)} s → ${Math.round(e.salida)} s`).join(', ')}`);
  } else {
    execFileSync(FFMPEG, ['-v', 'error', ...(recorteReal ? ['-ss', String(recorteReal)] : []), '-i', webm, '-an', '-vf', filtroSimple, ...argsVideo]);
  }
  const ficha = sondear(aroll);

  let script = null;
  let desfase = null;
  if (narracion) {
    if (narracion.length !== hitos.length) {
      desfase = { narracion: narracion.length, hitos: hitos.length };
      console.error(`[aviso] narración ${narracion.length} vs hitos ${hitos.length}: el guion sale incompleto`);
    }
    script = join(producer, 'script.txt');
    const lineas = hitos.slice(0, narracion.length).map((h, i) => `[${mmss(h.t)}] ${narracion[i]}`);
    writeFileSync(script, lineas.join('\n') + '\n');
  }
  writeFileSync(
    join(producer, 'hitos.json'),
    JSON.stringify({ slug, formato, grabado: new Date().toISOString(), sesion, duracionSeg: ficha.duracionSeg, hitos, desfase, resultado }, null, 2) + '\n',
  );
  const verificacion = verificarMaterial(carpeta, formato);
  return { webm, aroll, script, ficha, carpeta, formato, verificacion };
}

/** Ficha ffprobe del archivo, en los términos del checklist de entrega del Video Maker (§5). */
export function sondear(archivo) {
  const salida = execFileSync(FFPROBE, [
    '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration', '-of', 'json', archivo,
  ]).toString();
  const { streams = [], format = {} } = JSON.parse(salida);
  const v = streams.find((s) => s.codec_type === 'video') ?? {};
  const [n, d] = String(v.r_frame_rate ?? '0/1').split('/').map(Number);
  const duracion = Number(format.duration);
  return {
    duracionSeg: Number.isFinite(duracion) ? Math.round(duracion * 10) / 10 : null,
    ancho: v.width ?? null,
    alto: v.height ?? null,
    fps: d ? Math.round((n / d) * 100) / 100 : null,
    codec: v.codec_name ?? streams[0]?.codec_name ?? null,
    pixFmt: v.pix_fmt ?? null,
    conAudio: streams.some((s) => s.codec_type === 'audio'),
  };
}

// ─── Entrega al Video Maker ────────────────────────────────────────────────────────────────

const ROLES = ['aroll', 'broll', 'images', 'audio', 'logo', 'voice'];
const EXT_VIDEO = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
const EXT_IMAGEN = ['.jpg', '.jpeg', '.png', '.webp'];
const EXT_AUDIO = ['.wav', '.mp3', '.m4a', '.aac', '.flac'];
const EXT_POR_ROL = { aroll: EXT_VIDEO, broll: EXT_VIDEO, images: EXT_IMAGEN, audio: EXT_AUDIO, logo: ['.png'], voice: ['.wav', '.mp3'] };
const MARCA_RE = /^\[(\d{1,2}):(\d{2})(?:\s*[-–—]\s*(\d{1,2}):(\d{2}))?\]\s+(.+)$/;
// Palabras vacías que el motor descarta al buscar conceptos (aproximación suficiente para avisar).
const STOPWORDS = new Set(('para como esta este esto estas estos pero donde cuando entre desde hasta sobre tiene tienen'
  + ' hacer puede pueden todo todos cada otra otro otros otras mismo misma porque tambien solo antes despues'
  + ' ahora acá aca ella ellos ellas usted ustedes nosotros vamos vemos queda quedan nace').split(' '));

// Archivos de raw/logo que copia la receta de Video Maker en cada proyecto (marca de agua y bumpers): no se miden acá.
const GESTIONADOS_POR_VIDEO_MAKER = new Set(['raw/logo/isotipo.png', 'raw/logo/logo-largo.png']);

const listar = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.') && statSync(join(dir, f)).isFile()).sort() : []);
export const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n');

/**
 * Corre el checklist de entrega (contrato §5 + brief del proveedor) sobre una carpeta con el
 * layout media/<slug>/. No modifica nada: devuelve errores (bloquean), avisos y la ficha de cada
 * archivo, más los conceptos del guion y qué B-roll/foto los cubre.
 */
export function verificarMaterial(carpeta, formato = 'youtube-16x9') {
  const errores = [];
  const avisos = [];
  const archivos = [];
  const vertical = /9x16$/.test(formato);

  const arolls = listar(join(carpeta, 'raw', 'aroll'));
  if (arolls.length !== 1) errores.push(`raw/aroll debe tener exactamente 1 archivo (hay ${arolls.length})`);

  let duracionAroll = null;
  for (const rol of ROLES) {
    for (const nombre of listar(join(carpeta, 'raw', rol))) {
      const ruta = join(carpeta, 'raw', rol, nombre);
      const rel = `raw/${rol}/${nombre}`;
      if (GESTIONADOS_POR_VIDEO_MAKER.has(rel)) continue;
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(nombre)) errores.push(`${rel}: nombre no ASCII/minúsculas/sin espacios`);
      if (!EXT_POR_ROL[rol].includes(extname(nombre).toLowerCase())) errores.push(`${rel}: extensión no aceptada para ${rol}`);
      let ficha;
      try { ficha = sondear(ruta); } catch (e) { errores.push(`${rel}: ffprobe no lo puede leer`); continue; }
      archivos.push({ rol, archivo: rel, ...ficha });
      if (rol === 'aroll') {
        duracionAroll = ficha.duracionSeg;
        const esVertical = ficha.alto > ficha.ancho;
        if (esVertical !== vertical) errores.push(`${rel}: orientación ${esVertical ? 'vertical' : 'apaisada'} no coincide con el formato ${formato}`);
        if (ficha.pixFmt !== 'yuv420p') errores.push(`${rel}: pix_fmt ${ficha.pixFmt}, debe ser yuv420p`);
        if (ficha.fps && (ficha.fps < 25 || ficha.fps > 60)) errores.push(`${rel}: ${ficha.fps} fps fuera de 25–60`);
        if (ficha.conAudio) avisos.push(`${rel}: trae pista de audio — sólo corresponde si lleva voz humana; con voz generada entregar mudo (-an)`);
        if (ficha.duracionSeg && (ficha.duracionSeg < 20 || ficha.duracionSeg > 180)) avisos.push(`${rel}: ${ficha.duracionSeg} s (tutorial 60–180 s, reel 20–60 s)`);
      }
      if (rol === 'broll') {
        if (ficha.conAudio) avisos.push(`${rel}: B-roll con audio (se ignora, pero pesa)`);
        if (ficha.duracionSeg && (ficha.duracionSeg < 5 || ficha.duracionSeg > 30)) avisos.push(`${rel}: ${ficha.duracionSeg} s, fuera de 5–30 s`);
        if ((ficha.alto > ficha.ancho) !== vertical) errores.push(`${rel}: orientación distinta a la del formato`);
      }
      if (rol === 'audio' && duracionAroll && ficha.duracionSeg && ficha.duracionSeg < duracionAroll) {
        errores.push(`${rel}: música de ${ficha.duracionSeg} s, más corta que el A-roll (${duracionAroll} s) — loopearla`);
      }
      if (rol === 'logo') {
        if (!['rgba', 'bgra', 'pal8', 'ya8', 'argb'].includes(ficha.pixFmt)) errores.push(`${rel}: pix_fmt ${ficha.pixFmt} sin canal alfa`);
        if (ficha.ancho && ficha.ancho < 800) errores.push(`${rel}: ${ficha.ancho} px de ancho, mínimo 800`);
      }
    }
  }
  const audios = listar(join(carpeta, 'raw', 'audio'));
  if (audios.length > 1) avisos.push(`raw/audio: ${audios.length} pistas, el motor usa la primera alfabética`);
  const logos = listar(join(carpeta, 'raw', 'logo')).filter((f) => !GESTIONADOS_POR_VIDEO_MAKER.has(`raw/logo/${f}`));
  if (logos.length > 1) avisos.push(`raw/logo: ${logos.length} archivos, debería haber uno`);

  // Guion: una frase por línea, sin numerar, sin vacías; marcas crecientes dentro del A-roll.
  const rutaScript = join(carpeta, 'work', 'producer', 'script.txt');
  const guion = { existe: existsSync(rutaScript), frases: 0, conMarcas: 0, texto: '' };
  if (!guion.existe) {
    avisos.push('work/producer/script.txt no existe — obligatorio si la voz la genera el motor');
  } else {
    const lineas = readFileSync(rutaScript, 'utf8').split('\n');
    if (lineas.at(-1) === '') lineas.pop();
    let anterior = -1;
    lineas.forEach((l, i) => {
      if (!l.trim()) { errores.push(`script.txt línea ${i + 1}: vacía`); return; }
      if (/^\d+[.)]\s/.test(l)) errores.push(`script.txt línea ${i + 1}: numerada`);
      const m = l.match(MARCA_RE);
      const frase = m ? m[5] : l;
      guion.frases += 1;
      guion.texto += ' ' + frase;
      if (/https?:\/\/|www\./i.test(frase)) avisos.push(`script.txt línea ${i + 1}: URL en la narración`);
      if (m) {
        guion.conMarcas += 1;
        const t = Number(m[1]) * 60 + Number(m[2]);
        if (t <= anterior) errores.push(`script.txt línea ${i + 1}: marca ${m[1]}:${m[2]} no es creciente`);
        if (duracionAroll && t > duracionAroll) errores.push(`script.txt línea ${i + 1}: marca ${m[1]}:${m[2]} supera el A-roll (${duracionAroll} s)`);
        anterior = t;
      }
    });
    if (guion.conMarcas === 0) avisos.push('script.txt sin marcas [m:ss]: el video durará min(voz, A-roll) y la narración no queda sincronizada con la pantalla');
    if (guion.frases > 20) avisos.push(`script.txt: ${guion.frases} frases (hasta ~20 para 2–3 min)`);
  }

  // Conceptos: palabras ≥4 letras repetidas ≥3 veces; el B-roll entra sólo si un token del
  // nombre es exactamente un concepto (preset software-demo/hardware; educational pide ≥4).
  const cuenta = {};
  for (const w of normalizar(guion.texto).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w.length >= 4 && !STOPWORDS.has(w)) cuenta[w] = (cuenta[w] ?? 0) + 1;
  }
  const apoyos = archivos.filter((a) => a.rol === 'broll' || a.rol === 'images');
  const tokens = (a) => normalizar(basename(a.archivo, extname(a.archivo))).split(/[-_.\s]+/).filter((t) => t.length >= 4 && !/^\d+$/.test(t));
  const conceptos = Object.entries(cuenta)
    .filter(([, n]) => n >= 3)
    .sort((a, z) => z[1] - a[1])
    .map(([palabra, veces]) => ({ palabra, veces, cubiertoPor: apoyos.filter((a) => tokens(a).includes(palabra)).map((a) => a.archivo) }));
  for (const a of apoyos) {
    if (!conceptos.some((c) => c.cubiertoPor.includes(a.archivo))) {
      avisos.push(`${a.archivo}: ningún token de su nombre es un concepto del guion (≥3 veces, ≥4 letras) — nunca va a entrar`);
    }
  }

  for (const c of ['work/credits.json', 'work/producer/credits.json']) {
    if (existsSync(join(carpeta, c))) {
      try { JSON.parse(readFileSync(join(carpeta, c), 'utf8')); } catch { errores.push(`${c}: JSON inválido`); }
    }
  }

  return { ok: errores.length === 0, formato, carpeta, errores, avisos, archivos, guion: { existe: guion.existe, frases: guion.frases, conMarcas: guion.conMarcas }, conceptos };
}

export function leerFormato(carpeta) {
  const h = join(carpeta, 'work', 'producer', 'hitos.json');
  if (existsSync(h)) { try { return JSON.parse(readFileSync(h, 'utf8')).formato ?? 'youtube-16x9'; } catch {} }
  return 'youtube-16x9';
}

/** Informe de cierre dquien graba, en el formato que espera el productor. */
export function informeCierre({ slug, proyecto, destino, formato, verificacion: v, faltantes = [] }) {
  const fmt = FORMATOS[formato] ?? {};
  const linea = (a) => {
    const res = a.ancho ? `${a.ancho}×${a.alto}` : '—';
    const dur = a.duracionSeg != null ? `${a.duracionSeg} s` : '—';
    const extra = [a.fps ? `${a.fps} fps` : null, a.pixFmt, a.conAudio ? 'con audio' : (a.rol === 'aroll' || a.rol === 'broll' ? 'mudo' : null)].filter(Boolean).join(', ');
    return `  - ${a.archivo} · ${res} · ${dur}${extra ? ` · ${extra}` : ''}`;
  };
  const out = [];
  out.push(`CIERRE — material de video`);
  out.push(`- Slug: ${slug}${proyecto && proyecto !== slug ? ` · proyecto Video Maker: ${proyecto}` : ''}`);
  if (destino) out.push(`- Carpeta: ${destino}`);
  out.push(`- Plataforma: ${fmt.plataforma ?? formato} · format "${formato}"`);
  out.push(`- Archivos generados:`);
  if (v.archivos.length) out.push(...v.archivos.map(linea)); else out.push('  (ninguno)');
  out.push(`- Guion: ${v.guion.existe ? `${v.guion.frases} frases, ${v.guion.conMarcas} con marca [m:ss]` : 'sin script.txt'}`);
  out.push(`- Conceptos del guion (≥3 veces) y qué B-roll/foto los cubre:`);
  if (v.conceptos.length) {
    for (const c of v.conceptos) out.push(`  - "${c.palabra}" ×${c.veces} → ${c.cubiertoPor.length ? c.cubiertoPor.join(', ') : 'sin apoyo (sólo A-roll)'}`);
  } else out.push('  (ninguna palabra llega a 3 repeticiones)');
  const problemas = [...v.errores.map((e) => `ERROR ${e}`), ...v.avisos.map((a) => `aviso ${a}`), ...faltantes];
  out.push(`- Qué faltó o no cumple la spec:`);
  out.push(...(problemas.length ? problemas.map((p) => `  - ${p}`) : ['  - nada: checklist en verde']));
  out.push(`Ahí termina la grabación: la producción (voz, subtítulos, logo, música) la hace Video Maker sobre esa carpeta.`);
  return out.join('\n');
}

/** Extrae frames para REVISAR el material antes de producir. Nunca producir sin mirar. */
export function extraerFrames(mp4, cada = 8) {
  const dir = join(ROOT, 'scratch', 'video-out', 'frames', basename(mp4, '.mp4'));
  mkdirSync(dir, { recursive: true });
  execFileSync(FFMPEG, ['-v', 'error', '-i', mp4, '-vf', `fps=1/${cada},scale=800:-1`, join(dir, 'f%02d.png'), '-y']);
  return dir;
}

/**
 * Une varias tomas en un solo A-roll y recalcula los hitos, para rehacer SOLO el tramo que falló
 * sin volver a correr todo el flujo (que en producción crearía registros otra vez).
 * Cada toma: { aroll, desde = 0, hasta = fin, hitos = [] } con tiempos referidos a esa toma; los
 * hitos fuera del recorte se descartan y los demás se desplazan al tiempo del A-roll unido.
 * Escribe raw/aroll/<slug>.mp4 (re-encode, mismos parámetros del contrato) y devuelve los hitos.
 */
export function unirTomas({ slug, tomas, destino }) {
  const carpeta = destino ?? carpetaDeVideo(slug);
  const aroll = join(carpeta, 'raw', 'aroll', `${slug}.mp4`);
  mkdirSync(dirname(aroll), { recursive: true });
  const entradas = [];
  const filtros = [];
  const hitos = [];
  let offset = 0;
  tomas.forEach((t, i) => {
    const hasta = t.hasta ?? sondear(t.aroll).duracionSeg;
    const desde = t.desde ?? 0;
    entradas.push('-i', t.aroll);
    filtros.push(`[${i}:v]trim=start=${desde}:end=${hasta},setpts=PTS-STARTPTS[v${i}]`);
    for (const h of t.hitos ?? []) {
      if (h.t >= desde && h.t < hasta) hitos.push({ t: Math.round((h.t - desde + offset) * 10) / 10, texto: h.texto });
    }
    offset += hasta - desde;
  });
  const concat = tomas.map((_, i) => `[v${i}]`).join('') + `concat=n=${tomas.length}:v=1:a=0[v]`;
  const tmp = aroll + '.tmp.mp4';
  execFileSync(FFMPEG, [
    '-v', 'error', ...entradas, '-filter_complex', `${filtros.join(';')};${concat}`, '-map', '[v]', '-an',
    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp, '-y',
  ]);
  renameSync(tmp, aroll);
  return { aroll, hitos, ficha: sondear(aroll) };
}

/** Reescribe script.txt y hitos.json de una carpeta a partir de hitos ya cronometrados. */
export function escribirGuion({ slug, hitos, narracion, sesion, resultado, formato = 'youtube-16x9', destino }) {
  const carpeta = destino ?? carpetaDeVideo(slug);
  const producer = join(carpeta, 'work', 'producer');
  mkdirSync(producer, { recursive: true });
  if (narracion.length !== hitos.length) throw new Error(`narracion (${narracion.length}) y hitos (${hitos.length}) tienen que ir 1:1`);
  const script = join(producer, 'script.txt');
  writeFileSync(script, hitos.map((h, i) => `[${mmss(h.t)}] ${narracion[i]}`).join('\n') + '\n');
  const ficha = sondear(join(carpeta, 'raw', 'aroll', `${slug}.mp4`));
  writeFileSync(join(producer, 'hitos.json'), JSON.stringify({ slug, formato, grabado: new Date().toISOString(), sesion, duracionSeg: ficha.duracionSeg, hitos, resultado }, null, 2) + '\n');
  return { script, ficha };
}
