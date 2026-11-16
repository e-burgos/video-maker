import type { AgentsContent } from './agents-content';
import {
  CLAUDE_CODE_INSTALL,
  COPILOT_MCP_JSON,
  GEMINI_SETTINGS_JSON,
  MCP_NPX_COMMAND,
  STUDIO_URL_ENV,
} from './agent-configs';

export const AGENTS_ES: AgentsContent = {
  title: 'Conectar tus agentes',
  lede: 'Dejá que tu agente de código produzca videos con este studio: lee tu proyecto, prepara la marca y el material y maneja el studio por MCP. Publicar y borrar siempre los hacés vos desde acá.',
  studioNote: 'El studio tiene que estar abierto mientras el agente trabaja: la app de escritorio o pnpm studio.',
  sections: {
    'claude-code': {
      title: 'Claude Code',
      lede: 'El plugin trae las skills de producción de video y el servidor MCP ya configurado.',
      steps: [
        'Abrí Claude Code en el proyecto sobre el que querés el video.',
        'Agregá el marketplace e instalá el plugin con estos dos comandos.',
        'Reiniciá Claude Code si lo pide y pedí un video con palabras simples, por ejemplo «hacé un tutorial del checkout».',
      ],
      blocks: [{ id: 'install', label: 'Comandos en Claude Code', code: CLAUDE_CODE_INSTALL }],
    },
    copilot: {
      title: 'GitHub Copilot (VS Code)',
      lede: 'Copilot usa el servidor MCP directamente, sin plugin.',
      steps: [
        'En la raíz del proyecto creá la carpeta .vscode si no existe.',
        'Guardá este contenido en .vscode/mcp.json (si ya tiene servidores, sumá solo la entrada video-maker).',
        'En el chat de Copilot elegí el modo Agente y activá las herramientas de video-maker.',
      ],
      blocks: [{ id: 'mcp-json', label: '.vscode/mcp.json', code: COPILOT_MCP_JSON }],
    },
    gemini: {
      title: 'Gemini CLI',
      lede: 'Gemini CLI lee los servidores MCP de su archivo de ajustes.',
      steps: [
        'Abrí ~/.gemini/settings.json (o .gemini/settings.json dentro del proyecto).',
        'Agregá la entrada video-maker dentro de mcpServers, sin borrar las que ya tengas.',
        'Reiniciá Gemini CLI y corré /mcp para confirmar que video-maker aparece conectado.',
      ],
      blocks: [{ id: 'settings-json', label: 'settings.json', code: GEMINI_SETTINGS_JSON }],
    },
    other: {
      title: 'Otro cliente MCP',
      lede: 'Cualquier cliente que hable MCP por stdio puede conectarse con el mismo comando.',
      steps: [
        'Registrá un servidor stdio con este comando. Necesita Node.js 22 o superior.',
        'El servidor encuentra solo el studio abierto en esta máquina. Si necesitás forzar uno, definí la variable de entorno de abajo.',
      ],
      blocks: [
        { id: 'command', label: 'Comando', code: MCP_NPX_COMMAND },
        { id: 'env', label: 'Variable opcional para forzar el studio', code: STUDIO_URL_ENV },
      ],
    },
  },
};
