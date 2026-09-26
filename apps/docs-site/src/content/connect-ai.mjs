import { calloutBox, infoTable, screenshotFigure } from '../render.mjs';

export function renderPage(depth) {
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
${screenshotFigure(depth, 'settings-openrouter.png', 'Configuración → Productor con OpenRouter elegido, los modelos recomendados y el hint de la key ya cargada')}

<h3>Modelos recomendados y costo real</h3>
<p>
Precios verificados en vivo en el catálogo de OpenRouter (26/09/2026). El costo de una Receta Tutorial se
midió corriendo el video completo de punta a punta (guion, voz, música y render) con material
real — 817 989 tokens de entrada y 42 651 de salida en 4 turnos — y después se recalculó al
precio vigente de cada modelo:
</p>
${infoTable(
  ['Modelo', 'Precio por 1M tokens', 'Costo de una Receta Tutorial completa'],
  [
    [
      '<strong>DeepSeek V4.1 Flash</strong> (recomendado, es el que trae la app por defecto)',
      'US$0.14 entrada · US$0.42 salida',
      '<strong>≈US$0.13</strong> (recalculado al precio actual)',
    ],
    [
      'Claude Haiku 4.5 (referencia de calidad)',
      'US$1.00 entrada · US$5.00 salida',
      '≈US$1.03 (recalculado; no se corrió el mismo video con Haiku)',
    ],
  ],
)}

${calloutBox(
  'warning',
  '<p><strong>No recomendamos los modelos gratis de OpenRouter.</strong> Los probamos con el productor real y ' +
    'ninguno terminó la tarea: se saturan en los horarios de más uso, tienen un tope de pedidos por día y por minuto, ' +
    'algunos solo funcionan dentro de ciertas apps y, según la configuración de privacidad de tu cuenta, lo que les ' +
    'mandás puede usarse para entrenarlos. DeepSeek V4.1 Flash cuesta centavos por video.</p>' +
    '<p>Si igual querés probar uno, estos son los gratis que hoy aceptan herramientas e imágenes (lo que necesita el ' +
    'productor): <code>google/gemma-4-31b-it:free</code>, <code>qwen/qwen3.8-27b:free</code>, ' +
    '<code>google/gemma-4-26b-a4b-it:free</code> y <code>nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free</code>. ' +
    'Buscalo en Configuración → pestaña "Todos los modelos", sin garantía de que termine el video. Antes, ' +
    'revisá <a href="https://openrouter.ai/settings/privacy">openrouter.ai/settings/privacy</a>.</p>',
)}
`;

  return {
    title: 'Conectar la IA',
    description: 'Cómo conectar Claude Code o una API key de OpenRouter al productor de Video Maker, con costos reales.',
    bodyHtml,
  };
}
