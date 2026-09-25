import { calloutBox, infoTable } from '../render.mjs';

export function renderPage() {
  const bodyHtml = `
<h1>Conectar la IA</h1>
<p class="lede">
El productor necesita un motor de IA para conversar con vos, proponer el guion y decidir los
cortes. Elegís uno de los dos desde <strong>Configuración</strong> dentro de la app.
</p>

<h2>Opción A — Claude Code (tu propia suscripción)</h2>
<p>
Si ya tenés una suscripción de Claude y usás Claude Code en la terminal, es la opción más simple:
no cargás ninguna key, la app lo detecta solo.
</p>
${infoTable(
  ['Paso', 'Qué hacer'],
  [
    ['1. Instalar', 'Seguí la guía oficial de instalación de Claude Code: <a href="https://docs.claude.com/en/docs/claude-code/setup">docs.claude.com — Claude Code setup</a>.'],
    ['2. Iniciar sesión', 'Corré <code>claude</code> una vez en la Terminal y seguí el login con tu cuenta.'],
    ['3. Listo', 'Abrí (o reabrí) Video Maker — el primer arranque o Configuración va a mostrar "Claude · encontrado".'],
  ],
)}

<h2>Opción B — API key de OpenRouter</h2>
<p>
Si no tenés Claude Code, OpenRouter te da acceso a varios modelos con una sola key y crédito
prepago.
</p>
${infoTable(
  ['Paso', 'Qué hacer'],
  [
    ['1. Crear la key', 'Entrá a <a href="https://openrouter.ai/keys">openrouter.ai/keys</a>, creá una cuenta si no tenés y generá una API key.'],
    ['2. Cargar crédito', 'En <a href="https://openrouter.ai/settings/credits">openrouter.ai/settings/credits</a> cargás el crédito prepago que vayas a usar — no es una suscripción.'],
    ['3. Pegarla en la app', 'Configuración → Productor → Motor: OpenRouter → pegá la key. La app solo guarda un hint (por ejemplo "Key cargada ••••56f7"), nunca la muestra entera.'],
  ],
)}

<h3>Modelos recomendados y costo real</h3>
<p>
Medido corriendo la Receta Tutorial completa de punta a punta (guion, voz, música y render) con
material real:
</p>
${infoTable(
  ['Modelo', 'Precio por 1M tokens', 'Costo real de una Receta Tutorial completa'],
  [
    [
      '<strong>DeepSeek V4.1 Flash</strong> (recomendado, es el que trae la app por defecto)',
      'US$0.15 entrada · US$0.60 salida',
      '<strong>US$0.0714</strong> medido (817 989 tokens de entrada, 42 651 de salida, 4 turnos)',
    ],
    [
      'Claude Haiku 4.5 (referencia de calidad)',
      'US$1.00 entrada · US$5.00 salida',
      '≈US$1.03 estimado con los mismos tokens de la corrida anterior — no se corrió el mismo video con Haiku, es un cálculo a partir del precio',
    ],
  ],
)}

${calloutBox(
  'warning',
  '<p><strong>Modelos gratis de OpenRouter:</strong> hay opciones marcadas ":free" en el catálogo, pero OpenRouter ' +
    'limita cuántos pedidos por día y por minuto podés hacerles, y según la configuración de privacidad de tu cuenta ' +
    'las conversaciones con esos modelos pueden usarse para entrenarlos. Revisá esa configuración en ' +
    '<a href="https://openrouter.ai/settings/privacy">openrouter.ai/settings/privacy</a> antes de usarlos si te ' +
    'importa la privacidad de tu material.</p>',
)}
`;

  return {
    title: 'Conectar la IA',
    description: 'Cómo conectar Claude Code o una API key de OpenRouter al productor de Video Maker, con costos reales.',
    bodyHtml,
  };
}
