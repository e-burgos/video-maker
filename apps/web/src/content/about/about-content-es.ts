import { REPO_ISSUES_URL, REPO_LICENSE_URL, REPO_NOTICES_URL, REPO_URL, REMOTION_LICENSE_URL } from './about-content';
import type { AboutContent } from './about-content';

const SETUP_COMMANDS = `git clone ${REPO_URL}.git
cd video-maker
pnpm install
cp .env.example .env
brew install ffmpeg whisper-cpp
pnpm fetch:dev-voices
pnpm studio`;

const QUALITY_COMMANDS = `pnpm exec nx run-many -t lint test build
pnpm sdd:validate`;

export const ABOUT_ES: AboutContent = {
  requirements: {
    title: 'Requisitos del equipo',
    lede: 'Lo que Video Maker necesita en tu Mac para renderizar, transcribir, sintetizar voz y usar el productor. El estado sale del servicio local en vivo.',
    groups: {
      engine: 'Motor de render',
      media: 'Herramientas de audio y video',
      producer: 'Motores del productor',
    },
    producerNote: 'El productor necesita al menos uno de los dos motores. Con ninguno, igual podés renderizar, pero no conversar con la IA.',
    items: {
      'media-local': {
        label: 'Motor de medios',
        purpose: 'Corta, mezcla y transcribe tu material.',
        fix: 'Reiniciá la app. Si sigue sin cargar, reinstalá la última versión desde la web.',
      },
      'composition-remotion/render': {
        label: 'Motor de composición',
        purpose: 'Dibuja los cuadros del video con Remotion.',
        fix: 'Reiniciá la app. Si sigue sin cargar, reinstalá la última versión desde la web.',
      },
      ffmpeg: {
        label: 'FFmpeg',
        purpose: 'Codifica el MP4 y mezcla el audio.',
        fix: 'Con la app instalada viene incluido. En desarrollo: brew install ffmpeg y apuntá FFMPEG_PATH a su ruta.',
      },
      ffprobe: {
        label: 'FFprobe',
        purpose: 'Lee duración, resolución y pistas de tus archivos.',
        fix: 'Viene con FFmpeg. En desarrollo: apuntá FFPROBE_PATH al ffprobe de Homebrew.',
      },
      whisperCli: {
        label: 'whisper.cpp',
        purpose: 'Transcribe la voz palabra por palabra.',
        fix: 'Con la app instalada viene incluido. En desarrollo: brew install whisper-cpp y apuntá WHISPER_CPP_PATH al whisper-cli.',
      },
      whisperModel: {
        label: 'Modelo de Whisper',
        purpose: 'El modelo con el que whisper.cpp reconoce el habla.',
        fix: 'La app lo baja en el primer arranque; si falta, abrí de nuevo la app con internet. En desarrollo: descargá el modelo y apuntá WHISPER_MODEL_PATH.',
      },
      ttsCli: {
        label: 'Síntesis de voz',
        purpose: 'sherpa-onnx genera la locución con voces Piper, sin APIs pagas.',
        fix: 'Con la app instalada viene incluido. En desarrollo: apuntá TTS_CLI_PATH al ejecutable sherpa-onnx-offline-tts.',
      },
      ttsVoicesDir: {
        label: 'Voces Piper',
        purpose: 'Las voces en español que podés elegir para la locución.',
        fix: 'La app las baja en el primer arranque. En desarrollo: pnpm fetch:dev-voices y apuntá TTS_VOICES_DIR a esa carpeta.',
      },
      claudeCli: {
        label: 'Claude Code',
        purpose: 'Motor del productor con tu propia suscripción de Claude.',
        fix: 'Instalá Claude Code (npm i -g @anthropic-ai/claude-code), iniciá sesión con claude y reabrí la app.',
      },
      openrouter: {
        label: 'OpenRouter',
        purpose: 'Motor del productor con tu propia key y el modelo que elijas.',
        fix: 'Pegá tu key en Configuración, pestaña Productor.',
      },
    },
  },
  licenses: {
    title: 'Licencias y tecnología',
    lede: 'Cada pieza de software, modelo y voz que usa o empaqueta Video Maker, para qué sirve y bajo qué licencia llega.',
    ownCodeTitle: 'Código propio',
    ownCode: [
      'El código de Video Maker se publica con la ',
      { text: 'licencia MIT', href: REPO_LICENSE_URL },
      ' — © Esteban Burgos. Podés usarlo, copiarlo, modificarlo y redistribuirlo conservando el aviso de copyright.',
    ],
    remotionTitle: 'Sobre la licencia de Remotion',
    remotion: [
      'Remotion no es software libre: tiene su ',
      { text: 'licencia propia', href: REMOTION_LICENSE_URL },
      '. Es gratis para personas y empresas chicas bajo sus umbrales; una empresa por encima de esos umbrales necesita comprar una licencia de empresa de Remotion, aunque el código de Video Maker sea MIT.',
    ],
    noticesTitle: 'Avisos completos',
    notices: [
      'Los textos y avisos de cada binario, modelo, voz, tipografía y tema musical están en ',
      { text: 'THIRD_PARTY_NOTICES.md', href: REPO_NOTICES_URL },
      '.',
    ],
    inventoryTitle: 'Inventario de tecnología',
    inventoryLede: 'Nombre, versión, licencia y uso de cada componente.',
  },
  openSource: {
    title: 'Video Maker es código abierto',
    lede: 'Todo el estudio — la app de escritorio, el motor, el productor y la web — vive en un repositorio público. Leelo, correlo en tu máquina y proponé mejoras.',
    sections: [
      {
        id: 'license',
        title: 'Licencia MIT',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'El código se publica con la ',
              { text: 'licencia MIT', href: REPO_LICENSE_URL },
              '. Los binarios, modelos, voces, tipografías y temas musicales de terceros mantienen sus propias licencias; están en la pestaña Licencias.',
            ],
          },
          { kind: 'paragraph', parts: ['Repositorio: ', { text: 'github.com/e-burgos/video-maker', href: REPO_URL }] },
        ],
      },
      {
        id: 'run',
        title: 'Correrlo en tu máquina',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'Necesitás Node 22 o superior y pnpm 10. En ',
              { code: '.env' },
              ' van las rutas absolutas de ffmpeg, ffprobe, whisper-cli y el modelo de whisper; ',
              { code: '.env.example' },
              ' explica cada una.',
            ],
          },
          { kind: 'code', text: SETUP_COMMANDS },
          {
            kind: 'paragraph',
            parts: [
              { code: 'pnpm studio' },
              ' levanta el servicio local y el Web Studio juntos; la app de escritorio se arma con ',
              { code: 'pnpm desktop:dist' },
              ' (macOS Apple Silicon).',
            ],
          },
        ],
      },
      {
        id: 'contribute',
        title: 'Cómo contribuir',
        blocks: [
          {
            kind: 'list',
            items: [
              ['Abrí un issue en ', { text: 'Issues', href: REPO_ISSUES_URL }, ' antes de escribir código, para acordar el alcance.'],
              ['Seguí el flujo SDD: cada funcionalidad nace de una spec en ', { code: 'sdd/specs/' }, ' y cada arreglo se registra en ', { code: 'sdd/fixes.json' }, '.'],
              ['Código que se explica solo: sin comentarios narrativos, con nombres declarativos y funciones cortas.'],
            ],
          },
          { kind: 'paragraph', parts: ['Todo en verde antes del pull request:'] },
          { kind: 'code', text: QUALITY_COMMANDS },
          { kind: 'paragraph', parts: ['Abrí el pull request desde una rama propia, con qué cambia y cómo lo probaste.'] },
        ],
      },
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    lede: 'Video Maker es un estudio de video que corre en tu computadora. Esto explica qué datos usa, para qué y cómo controlarlos. Última actualización: 8 de octubre de 2026.',
    sections: [
      {
        id: 'local',
        title: 'Lo que queda en tu computadora',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'Tu material (videos, fotos, audio), los proyectos, las marcas y los videos terminados se guardan en las carpetas que elegís en tu equipo. La transcripción, la voz y el render corren localmente. Video Maker no tiene servidores propios: no recibimos, no guardamos ni vemos tu material.',
            ],
          },
        ],
      },
      {
        id: 'youtube',
        title: 'Conexión con YouTube',
        blocks: [
          {
            kind: 'paragraph',
            parts: ['Si conectás tu canal desde Configuración, Video Maker te pide, a través del inicio de sesión de Google, dos permisos de la API de datos de YouTube:'],
          },
          {
            kind: 'list',
            items: [
              ['Subir videos (', { code: 'youtube.upload' }, '): para publicar en tu canal solo los videos que elegís publicar, con el título, la descripción, las etiquetas, la visibilidad y la fecha que confirmás.'],
              ['Ver tu cuenta de YouTube (', { code: 'youtube.readonly' }, '): para mostrar el nombre y la imagen de tu canal y tus listas de reproducción al publicar.'],
            ],
          },
          {
            kind: 'paragraph',
            parts: [
              'La autorización que entrega Google se guarda solo en tu computadora (en la app de escritorio, en el llavero del sistema) y se usa únicamente para esas acciones. No la compartimos con nadie, no la usamos para publicidad ni para entrenar modelos, y no leemos ni modificamos otros videos, comentarios o datos de tu cuenta.',
            ],
          },
          {
            kind: 'paragraph',
            parts: [
              'El uso de la información recibida de las API de Google se ajusta a la ',
              { text: 'Política de Datos del Usuario de los Servicios de API de Google', href: 'https://developers.google.com/terms/api-services-user-data-policy' },
              ', incluidos los requisitos de uso limitado. Al publicar en YouTube también aplican las ',
              { text: 'Condiciones del Servicio de YouTube', href: 'https://www.youtube.com/t/terms' },
              ' y la ',
              { text: 'Política de Privacidad de Google', href: 'https://policies.google.com/privacy' },
              '.',
            ],
          },
        ],
      },
      {
        id: 'disconnect',
        title: 'Cómo desconectar tu canal',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'En Configuración → YouTube → "Desconectar" se revoca la autorización y se borra de tu computadora. También podés quitar el acceso en cualquier momento desde ',
              { text: 'la página de permisos de tu cuenta de Google', href: 'https://myaccount.google.com/permissions' },
              '.',
            ],
          },
        ],
      },
      {
        id: 'ai',
        title: 'Inteligencia artificial',
        blocks: [
          {
            kind: 'paragraph',
            parts: [
              'Cuando usás el productor o pedís que redacte el título y la descripción de un video, el texto necesario (tu conversación, el guion del video y los datos de tu marca) se envía al servicio de IA que conectaste: Claude, con tu propia suscripción, u OpenRouter, con tu propia key. Esos servicios lo procesan según sus propias políticas.',
            ],
          },
        ],
      },
      {
        id: 'contact',
        title: 'Contacto',
        blocks: [
          {
            kind: 'paragraph',
            parts: ['Consultas sobre esta política: ', { text: 'displayadsdigital@gmail.com', href: 'mailto:displayadsdigital@gmail.com' }, '.'],
          },
        ],
      },
    ],
  },
};
