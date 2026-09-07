import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'timeline-core es determinista: el tiempo entra por parámetro.' },
        { name: 'process', message: 'timeline-core no lee el entorno.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Usar mulberry32(seed).' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'fs', 'path', 'child_process', 'os'], message: 'timeline-core no hace I/O.' },
            { group: ['react', 'react-dom', 'react/*'], message: 'timeline-core es isomórfica y sin UI.' },
          ],
        },
      ],
    },
  },
];
