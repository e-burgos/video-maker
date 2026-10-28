import { abrirGrabacion, clic, escribir, pausa, aire, irARuta, cerrarYExportar, informeCierre } from '../lib-record.mjs';

const SLUG = '<slug>';
const BASE_URL = process.env.APP_URL ?? '<http://localhost:PUERTO>';

const NARRACION = [
  '<frase del hito 1>',
  '<frase del hito 2>',
];

const palabras = (frase) => frase.trim().split(/\s+/).length;
const ventana = (n) => aire(page, palabras(NARRACION[n]) / 2.5 + 0.6);

const { browser, ctx, page, apiJson, hito, hitos, sesion, base } = await abrirGrabacion({
  slug: SLUG,
  baseUrl: BASE_URL,
});
let resultado = { ok: false };

try {
  hito('<hito 1: qué se ve>');
  await irARuta(page, base, '/<ruta>');
  await ventana(0);

  hito('<hito 2: la acción>');
  await clic(page, page.getByRole('button', { name: /<texto del botón>/i }).first(), 1500);
  await ventana(1);

  const efecto = apiJson.filter((p) => p.metodo === 'POST').map((p) => p.url);
  resultado = { ok: efecto.length > 0, efecto };
} catch (e) {
  resultado = { ok: false, error: String(e).slice(0, 300) };
} finally {
  const salida = await cerrarYExportar({ ctx, page, browser, slug: SLUG, hitos, narracion: NARRACION, sesion, resultado });
  console.log(JSON.stringify({ ...resultado, sesion, hitos, ficha: salida.ficha, aroll: salida.aroll, script: salida.script }, null, 2));
  if (salida.verificacion) console.log('\n' + informeCierre({ slug: SLUG, destino: salida.carpeta, formato: salida.formato, verificacion: salida.verificacion }));
}
