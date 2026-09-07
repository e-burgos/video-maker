import baseConfig from '../../eslint.config.mjs';

const BROWSER_UNSAFE_IMPORTS = ['node:*', 'fs', 'path', 'child_process', 'os'];
const REMOTION_NODE_PACKAGES = ['@remotion/bundler', '@remotion/renderer'];

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/render.ts', 'src/smoke.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Un frame se calcula desde `frame`, nunca desde el reloj.' },
        { name: 'process', message: 'El barrel browser-safe no lee el entorno.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'composition-remotion es determinista.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: BROWSER_UNSAFE_IMPORTS, message: 'src/index.ts tiene que cargar en un browser.' },
            {
              group: REMOTION_NODE_PACKAGES,
              message: 'Los paquetes Node de Remotion solo se importan desde src/render.ts o src/smoke.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/render.ts', 'src/smoke.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'composition-remotion es determinista.' },
      ],
    },
  },
];
