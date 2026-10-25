import { APP_DISPLAY_NAME } from '../site-config.mjs';
import { pageHref } from '../routes.mjs';

const CONTACT_EMAIL = 'displayadsdigital@gmail.com';

function bodyEs() {
  return `
<h1>Política de privacidad</h1>
<p class="lede">
${APP_DISPLAY_NAME} es un estudio de video que corre en tu computadora. Esta página explica qué datos usa, para qué
y cómo controlarlos. Última actualización: 8 de octubre de 2026.
</p>

<h2>Lo que queda en tu computadora</h2>
<p>Tu material (videos, fotos, audio), los proyectos, las marcas y los videos terminados se guardan en las carpetas
que elegís en tu equipo. La transcripción, la voz y el render corren localmente. ${APP_DISPLAY_NAME} no tiene
servidores propios: no recibimos, no guardamos ni vemos tu material.</p>

<h2>Conexión con YouTube</h2>
<p>Si conectás tu canal desde Configuración, ${APP_DISPLAY_NAME} te pide, a través del inicio de sesión de Google,
dos permisos de la API de datos de YouTube:</p>
<ul>
<li><strong>Subir videos</strong> (<code>youtube.upload</code>): para publicar en tu canal solo los videos que elegís
publicar, con el título, la descripción, las etiquetas, la visibilidad y la fecha que confirmás.</li>
<li><strong>Ver tu cuenta de YouTube</strong> (<code>youtube.readonly</code>): para mostrar el nombre y la imagen de
tu canal y tus listas de reproducción al publicar.</li>
</ul>
<p>La autorización que entrega Google se guarda solo en tu computadora (en la app de escritorio, en el llavero del
sistema) y se usa únicamente para esas acciones. No la compartimos con
nadie, no la usamos para publicidad ni para entrenar modelos, y no leemos ni modificamos otros videos, comentarios o
datos de tu cuenta.</p>
<p>El uso de la información recibida de las API de Google se ajusta a la
<a href="https://developers.google.com/terms/api-services-user-data-policy">Política de Datos del Usuario de los
Servicios de API de Google</a>, incluidos los requisitos de uso limitado. Al publicar en YouTube también aplican las
<a href="https://www.youtube.com/t/terms">Condiciones del Servicio de YouTube</a> y la
<a href="https://policies.google.com/privacy">Política de Privacidad de Google</a>.</p>

<h2>Cómo desconectar tu canal</h2>
<p>En ${APP_DISPLAY_NAME}, Configuración → YouTube → "Desconectar" revoca la autorización y la borra de tu
computadora. También podés quitar el acceso en cualquier momento desde
<a href="https://myaccount.google.com/permissions">la página de permisos de tu cuenta de Google</a>.</p>

<h2>Inteligencia artificial</h2>
<p>Cuando usás el productor o pedís que redacte el título y la descripción de un video, el texto necesario (tu
conversación, el guion del video y los datos de tu marca) se envía al servicio de IA que conectaste: Claude, con tu
propia suscripción, u OpenRouter, con tu propia key. Esos servicios lo procesan según sus propias políticas.</p>

<h2>Contacto</h2>
<p>Consultas sobre esta política: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
`;
}

function bodyEn(ctx) {
  return `
<h1>Privacy policy</h1>
<p class="lede">
${APP_DISPLAY_NAME} is a video studio that runs on your computer. This page explains what data it uses, what for
and how to control it. Last updated: October 8, 2026.
</p>
<p class="muted">This is a translation of the <a href="${pageHref(ctx, 'privacy', 'es')}" hreflang="es" lang="es">Spanish policy</a>; if they differ, the Spanish version prevails.</p>

<h2>What stays on your computer</h2>
<p>Your material (videos, photos, audio), projects, brands and finished videos are stored in the folders you choose
on your machine. Transcription, voice and rendering run locally. ${APP_DISPLAY_NAME} has no servers of its own: we do
not receive, store or see your material.</p>

<h2>YouTube connection</h2>
<p>If you connect your channel from Settings, ${APP_DISPLAY_NAME} asks you, through Google sign-in, for two
YouTube Data API permissions:</p>
<ul>
<li><strong>Upload videos</strong> (<code>youtube.upload</code>): to publish to your channel only the videos you choose
to publish, with the title, description, tags, visibility and date you confirm.</li>
<li><strong>View your YouTube account</strong> (<code>youtube.readonly</code>): to show your channel’s name and picture
and your playlists when publishing.</li>
</ul>
<p>The authorization Google grants is stored only on your computer (in the desktop app, in the system keychain) and
is used only for those actions. We do not share it with anyone, we do not use it for advertising or to train models,
and we do not read or modify other videos, comments or data in your account.</p>
<p>The use of information received from Google APIs adheres to the
<a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
including the Limited Use requirements. When publishing to YouTube, the
<a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a> and the
<a href="https://policies.google.com/privacy">Google Privacy Policy</a> also apply.</p>

<h2>How to disconnect your channel</h2>
<p>In ${APP_DISPLAY_NAME}, Settings → YouTube → "Disconnect" revokes the authorization and deletes it from your
computer. You can also remove access at any time from
<a href="https://myaccount.google.com/permissions">your Google account permissions page</a>.</p>

<h2>Artificial intelligence</h2>
<p>When you use the producer or ask it to write a video’s title and description, the necessary text (your
conversation, the video script and your brand details) is sent to the AI service you connected: Claude, with your
own subscription, or OpenRouter, with your own key. Those services process it under their own policies.</p>

<h2>Contact</h2>
<p>Questions about this policy: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
`;
}

const PAGES = {
  es: () => ({
    title: 'Política de privacidad',
    description: `Qué datos usa ${APP_DISPLAY_NAME}, para qué, y cómo controlar la conexión con YouTube.`,
    bodyHtml: bodyEs(),
  }),
  en: (ctx) => ({
    title: 'Privacy policy',
    description: `What data ${APP_DISPLAY_NAME} uses, what for, and how to control the YouTube connection.`,
    bodyHtml: bodyEn(ctx),
  }),
};

export function renderPage(ctx) {
  return PAGES[ctx.locale](ctx);
}
