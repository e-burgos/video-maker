import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'fs', 'path', 'child_process', 'os'], message: 'motion-graphics no hace I/O: los consumidores leen y escriben.' },
            { group: ['react', 'react-dom', 'react/*'], message: 'motion-graphics no tiene UI.' },
          ],
        },
      ],
    },
  },
  { ignores: ['assets/**'] },
];
