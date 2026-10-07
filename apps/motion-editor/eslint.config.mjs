import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  { files: ['**/*.jsx', '**/*.tsx'], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  { files: ['**/animations-v2.jsx', '**/tweaks-panel.jsx'], linterOptions: { reportUnusedDisableDirectives: 'off' } },
  { ignores: ['dist'] },
];
