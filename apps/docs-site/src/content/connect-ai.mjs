import { calloutBox, infoTable, screenshotFigure } from '../render.mjs';

const FREE_MODEL_IDS =
  '<code>google/gemma-4-31b-it:free</code>, <code>qwen/qwen3.8-27b:free</code>, <code>google/gemma-4-26b-a4b-it:free</code>';
const LAST_FREE_MODEL_ID = '<code>nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free</code>';

function bodyEs(ctx) {
  return `
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
${screenshotFigure(ctx, 'settings-openrouter.png', 'Configuración → Productor con OpenRouter elegido, los modelos recomendados y el hint de la key ya cargada')}

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
    ['<strong>DeepSeek V4.1 Flash</strong> (recomendado, es el que trae la app por defecto)', 'US$0.14 entrada · US$0.42 salida', '<strong>≈US$0.13</strong> (recalculado al precio actual)'],
    ['Claude Haiku 4.5 (referencia de calidad)', 'US$1.00 entrada · US$5.00 salida', '≈US$1.03 (recalculado; no se corrió el mismo video con Haiku)'],
  ],
)}

${calloutBox(
  'warning',
  '<p><strong>No recomendamos los modelos gratis de OpenRouter.</strong> Los probamos con el productor real y ' +
    'ninguno terminó la tarea: se saturan en los horarios de más uso, tienen un tope de pedidos por día y por minuto, ' +
    'algunos solo funcionan dentro de ciertas apps y, según la configuración de privacidad de tu cuenta, lo que les ' +
    'mandás puede usarse para entrenarlos. DeepSeek V4.1 Flash cuesta centavos por video.</p>' +
    `<p>Si igual querés probar uno, estos son los gratis que hoy aceptan herramientas e imágenes (lo que necesita el productor): ${FREE_MODEL_IDS} y ${LAST_FREE_MODEL_ID}. ` +
    'Buscalo en Configuración → pestaña "Todos los modelos", sin garantía de que termine el video. Antes, ' +
    'revisá <a href="https://openrouter.ai/settings/privacy">openrouter.ai/settings/privacy</a>.</p>',
)}
`;
}

function bodyEn(ctx) {
  return `
<h1>Connect the AI</h1>
<p class="lede">
The producer needs an AI engine to chat with you, propose the script and decide the cuts. You pick
one of the two from <strong>Settings</strong> inside the app.
</p>

<h2>Option A — Claude Code (your own subscription)</h2>
<p>
If you already have a Claude subscription and use Claude Code in the terminal, this is the simplest
option: no key to enter, the app detects it on its own.
</p>
${infoTable(
  ['Step', 'What to do'],
  [
    ['1. Install', 'Follow the official Claude Code installation guide: <a href="https://docs.claude.com/en/docs/claude-code/setup">docs.claude.com — Claude Code setup</a>.'],
    ['2. Sign in', 'Run <code>claude</code> once in Terminal and complete the login with your account.'],
    ['3. Done', 'Open (or reopen) Video Maker — the first run or Settings will show that Claude was found.'],
  ],
)}

<h2>Option B — OpenRouter API key</h2>
<p>
If you do not have Claude Code, OpenRouter gives you access to many models with a single key and
prepaid credit.
</p>
${infoTable(
  ['Step', 'What to do'],
  [
    ['1. Create the key', 'Go to <a href="https://openrouter.ai/keys">openrouter.ai/keys</a>, sign up if needed and create an API key.'],
    ['2. Add credit', 'At <a href="https://openrouter.ai/settings/credits">openrouter.ai/settings/credits</a> you load the prepaid credit you plan to use — it is not a subscription.'],
    ['3. Paste it in the app', 'Settings → Producer → Engine: OpenRouter → paste the key. The app only keeps a hint (for example "Key loaded ••••56f7") and never shows it in full.'],
  ],
)}
${screenshotFigure(ctx, 'settings-openrouter.png', 'Settings → Producer with OpenRouter selected, the recommended models and the hint of the key already loaded')}

<h3>Recommended models and real cost</h3>
<p>
Prices checked live on the OpenRouter catalog (2026-09-26). The cost of a Tutorial recipe was measured by
running the full video end to end (script, voice, music and render) with real material —
817,989 input tokens and 42,651 output tokens over 4 turns — and then recalculated at each model’s
current price:
</p>
${infoTable(
  ['Model', 'Price per 1M tokens', 'Cost of a full Tutorial recipe'],
  [
    ['<strong>DeepSeek V4.1 Flash</strong> (recommended, the app’s default)', 'US$0.14 input · US$0.42 output', '<strong>≈US$0.13</strong> (recalculated at the current price)'],
    ['Claude Haiku 4.5 (quality reference)', 'US$1.00 input · US$5.00 output', '≈US$1.03 (recalculated; the same video was not run with Haiku)'],
  ],
)}

${calloutBox(
  'warning',
  '<p><strong>We do not recommend OpenRouter’s free models.</strong> We tried them with the real producer and ' +
    'none of them finished the job: they get saturated at peak hours, have per-day and per-minute request caps, ' +
    'some only work inside certain apps and, depending on your account’s privacy settings, what you send them ' +
    'may be used for training. DeepSeek V4.1 Flash costs cents per video.</p>' +
    `<p>If you still want to try one, these are the free ones that currently accept tools and images (what the producer needs): ${FREE_MODEL_IDS} and ${LAST_FREE_MODEL_ID}. ` +
    'Look for it in Settings → "All models" tab, with no guarantee it will finish the video. First, ' +
    'check <a href="https://openrouter.ai/settings/privacy">openrouter.ai/settings/privacy</a>.</p>',
)}
`;
}

const PAGES = {
  es: (ctx) => ({
    title: 'Conectar la IA',
    description: 'Cómo conectar Claude Code o una API key de OpenRouter al productor de Video Maker, con costos reales.',
    bodyHtml: bodyEs(ctx),
  }),
  en: (ctx) => ({
    title: 'Connect the AI',
    description: 'How to connect Claude Code or an OpenRouter API key to the Video Maker producer, with real costs.',
    bodyHtml: bodyEn(ctx),
  }),
};

export function renderPage(ctx) {
  return PAGES[ctx.locale](ctx);
}
