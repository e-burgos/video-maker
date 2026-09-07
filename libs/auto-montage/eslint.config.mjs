import baseConfig from '../../eslint.config.mjs';

const NODE_FS = ['node:fs', 'node:fs/promises', 'fs', 'fs/promises'];
const CHILD_PROCESS = ['node:child_process', 'child_process', 'execa'];
const NODE_PATH = ['node:path', 'path'];
const NODE_PATH_POSIX = ['node:path/posix', 'path/posix'];
const NO_SYSTEM_OR_NETWORK = ['node:os', 'os', 'node:http', 'node:https', 'node:net'];
const RENDER_LAYER = [
  'react',
  'react-dom',
  'react/*',
  'remotion',
  '@remotion/*',
  '@video-maker/composition-remotion',
  '@video-maker/composition-remotion/*',
];

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'El reloj entra por Clock: probedAt es inyectable (D-6).' },
        { name: 'process', message: 'El entorno entra por parámetro (IngestOptions.binaries, ya resuelto por el llamador).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'auto-montage es determinista: el seed entra por parámetro.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: NODE_FS, message: 'El filesystem entra por los ports de src/fs/.' },
            { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO a través de CommandRunner; el runner concreto vive en media-local.' },
            { group: NODE_PATH, message: 'El separador de Windows en el catálogo rompe la portabilidad (D-2/CA-003): usar node:path/posix desde src/project/project-paths.ts.' },
            { group: NODE_PATH_POSIX, message: 'El álgebra de rutas vive en src/project/project-paths.ts.' },
            { group: NO_SYSTEM_OR_NETWORK, message: 'auto-montage no lee el sistema ni la red.' },
            { group: RENDER_LAYER, message: 'auto-montage no renderiza: el render lo cablea tools/render-cli.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/fs/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO a través de CommandRunner; el runner concreto vive en media-local.' },
            { group: RENDER_LAYER, message: 'auto-montage no renderiza: el render lo cablea tools/render-cli.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/project/project-paths.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: NODE_FS, message: 'El filesystem entra por los ports de src/fs/.' },
            { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO a través de CommandRunner; el runner concreto vive en media-local.' },
            { group: RENDER_LAYER, message: 'auto-montage no renderiza: el render lo cablea tools/render-cli.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/__fixtures__/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO a través de CommandRunner; el runner concreto vive en media-local.' },
            { group: RENDER_LAYER, message: 'auto-montage no renderiza: el render lo cablea tools/render-cli.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.spec.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['src/smoke.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
];
