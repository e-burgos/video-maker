import { APP_DISPLAY_NAME } from '../site-config.mjs';

export function renderPage() {
  const bodyHtml = `
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
<p>Consultas sobre esta política: <a href="mailto:displayadsdigital@gmail.com">displayadsdigital@gmail.com</a>.</p>
`;

  return {
    title: 'Política de privacidad',
    description: `Qué datos usa ${APP_DISPLAY_NAME}, para qué, y cómo controlar la conexión con YouTube.`,
    bodyHtml,
  };
}
