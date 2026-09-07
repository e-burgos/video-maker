import baseConfig from '../../eslint.config.mjs';

const NODE_FS = ['node:fs', 'node:fs/promises', 'fs', 'fs/promises'];
const CHILD_PROCESS = ['node:child_process', 'child_process'];

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'El reloj entra por Clock (src/clock.ts): probedAt es inyectable.' },
        { name: 'process', message: 'El entorno entra por parámetro (resolveBinaries(env)).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'media-local es determinista: nombres y rutas son explícitos.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO a través de CommandRunner.' },
            { group: NODE_FS, message: 'El filesystem entra por los ports de src/fs/.' },
            { group: ['execa'], message: 'execa se importa solo en src/runner/execa-command-runner.ts.' },
            { group: ['react', 'react-dom', 'react/*'], message: 'media-local es Node puro, sin UI.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/fs/**/*.ts', 'src/__fixtures__/**/*.ts', 'src/**/*.spec.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: CHILD_PROCESS, message: 'Los comandos se ejecutan SOLO a través de CommandRunner.' },
      { group: ['react', 'react-dom', 'react/*'], message: 'media-local es Node puro, sin UI.' },
    ] }] },
  },
  {
    files: ['src/runner/execa-command-runner.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: CHILD_PROCESS, message: 'Usar execa, no child_process.' },
      { group: NODE_FS, message: 'El runner no toca el filesystem.' },
    ] }] },
  },
  { files: ['src/clock.ts'], rules: { 'no-restricted-globals': 'off' } },
  { files: ['src/**/*.spec.ts'], rules: { 'no-restricted-globals': 'off' } },
];
